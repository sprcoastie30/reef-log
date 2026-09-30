/*
 * Holdfast sync: keeps the on-device log the same across a user's phone and computer.
 * Works offline first; when signed in, it sends local changes and pulls changes from other devices.
 * Newest edit wins per record. Photos sync as files.
 * Cloud backend: Supabase (auth, a "docs" table, a private "photos" storage bucket). See supabase/setup.sql.
 * Copyright (c) 2026 Carl Peterson. All rights reserved.
 */
(function () {
  "use strict";
  var store = window.__reefStore;
  if (!store) return;
  var cfg = window.REEF_CONFIG || {};
  var backend = null, user = null, syncing = false, again = false, timer = null, lastSync = 0, lastError = "", recovering = false;

  // ---------- Supabase adapter ----------
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("Couldn't load the sync library. Check your connection.")); };
      document.head.appendChild(s);
    });
  }
  function supabaseBackend() {
    var sb = null, uidCache = null;
    function client() {
      if (sb) return Promise.resolve(sb);
      var ready = window.supabase ? Promise.resolve() : loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js");
      return ready.then(function () {
        sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
        sb.auth.onAuthStateChange(function (ev, session) {
          uidCache = session && session.user ? session.user.id : null;
          if (ev === "PASSWORD_RECOVERY") { recovering = true; }
          handleAuth(session && session.user ? { id: session.user.id, email: session.user.email } : null);
        });
        return sb;
      });
    }
    function check(r) { if (r.error) throw r.error; return r.data; }
    var redirect = location.origin + location.pathname;
    return {
      name: "supabase",
      currentUser: function () { return client().then(function (c) { return c.auth.getSession(); }).then(function (r) { var u = r.data && r.data.session && r.data.session.user; uidCache = u ? u.id : null; return u ? { id: u.id, email: u.email } : null; }); },
      signIn: function (email, pw) { return client().then(function (c) { return c.auth.signInWithPassword({ email: email, password: pw }); }).then(check); },
      signUp: function (email, pw) { return client().then(function (c) { return c.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: redirect } }); }).then(check); },
      signOut: function () { return client().then(function (c) { return c.auth.signOut(); }); },
      resetPassword: function (email) { return client().then(function (c) { return c.auth.resetPasswordForEmail(email, { redirectTo: redirect }); }).then(check); },
      setPassword: function (pw) { return client().then(function (c) { return c.auth.updateUser({ password: pw }); }).then(check); },
      pullSince: function (cursor) {
        return client().then(function (c) {
          var rows = [];
          function page(from) {
            return c.from("docs").select("path,data,deleted,updated_at,server_updated").gte("server_updated", cursor)
              .order("server_updated", { ascending: true }).order("path", { ascending: true }).range(from, from + 499)
              .then(check).then(function (d) { rows = rows.concat(d); return d.length === 500 ? page(from + 500) : rows; });
          }
          return page(0);
        }).then(function (rows) { return rows.map(function (r) { return { path: r.path, data: r.data, deleted: r.deleted, u: Number(r.updated_at), t: r.server_updated }; }); });
      },
      push: function (rows) {
        return client().then(function (c) {
          return c.from("docs").upsert(rows.map(function (r) { return { user_id: uidCache, path: r.path, data: r.data, deleted: r.deleted, updated_at: r.u }; }), { onConflict: "user_id,path" });
        }).then(check);
      },
      uploadBlob: function (id, blob) { return client().then(function (c) { return c.storage.from("photos").upload(uidCache + "/" + id, blob, { upsert: true, contentType: blob.type || "image/jpeg" }); }).then(check); },
      downloadBlob: function (id) { return client().then(function (c) { return c.storage.from("photos").download(uidCache + "/" + id); }).then(check); },
      removeBlobs: function (ids) { return client().then(function (c) { return c.storage.from("photos").remove(ids.map(function (id) { return uidCache + "/" + id; })); }).then(check); }
    };
  }

  // ---------- sync engine ----------
  function chunks(a, n) { var out = []; for (var i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; }
  function serial(items, fn) { return items.reduce(function (p, x) { return p.then(function () { return fn(x); }); }, Promise.resolve()); }

  function syncOnce() {
    if (!backend || !user) return Promise.resolve();
    if (syncing) { again = true; return Promise.resolve(); }
    if (!navigator.onLine) { setStatus(); return Promise.resolve(); }
    syncing = true; again = false; setStatus();
    var cursor = store.getKV("cursor") || "1970-01-01T00:00:00Z";
    // Re-read a few seconds back each time so nothing committed near the boundary is missed (applying twice is harmless).
    var from = new Date(new Date(cursor).getTime() - 5000).toISOString();
    var maxT = cursor;
    return backend.pullSince(from)
      .then(function (rows) {
        return serial(rows, function (r) {
          if (r.t && r.t > maxT) maxT = r.t;
          return store.applyRemote(r.path, r.data, r.u, r.deleted);
        });
      })
      .then(function () { return store.setKV("cursor", maxT); })
      .then(function () { // photos another device added
        var missing = store.photoAssetIds().filter(function (id) { return !store.hasBlob(id); });
        return serial(missing, function (id) { return backend.downloadBlob(id).then(function (b) { return store.putRemoteBlob(id, b); }).catch(function () {}); });
      })
      .then(function () { return serial(store.blobsToUpload(), function (id) { var b = store.getBlob(id); return b ? backend.uploadBlob(id, b).then(function () { return store.markBlobUploaded(id); }) : null; }); })
      .then(function () {
        var dirty = store.dirtyDocs();
        return serial(chunks(dirty, 200), function (batch) {
          return backend.push(batch).then(function () { return Promise.all(batch.map(function (r) { return store.markClean(r.path, r.u); })); });
        });
      })
      .then(function () { var del = store.blobsToDelete(); return del.length ? backend.removeBlobs(del).then(function () { return Promise.all(del.map(store.markBlobDeleted)); }) : null; })
      .then(function () { lastSync = Date.now(); lastError = ""; })
      .catch(function (e) { lastError = (e && (e.message || e.error_description)) || "Sync failed"; console.warn("Holdfast sync:", e); })
      .then(function () { syncing = false; setStatus(); if (again) schedule(500); });
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(syncOnce, ms == null ? 2500 : ms); }

  function handleAuth(u) {
    var prev = user; user = u;
    if (u && (!prev || prev.id !== u.id)) {
      var acct = store.getKV("account");
      var p = acct && acct !== u.id ? store.resetSyncState() : Promise.resolve();
      p.then(function () { return store.setKV("account", u.id); }).then(function () { schedule(0); });
    }
    render();
  }

  // ---------- UI ----------
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ago(t) {
    if (!t) return "not yet";
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return "just now"; if (s < 3600) return Math.round(s / 60) + " min ago";
    return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function setStatus() {
    var chip = $("m-sync"); if (!chip) return;
    if (!backend) { chip.textContent = ""; return; }
    if (!user) { chip.textContent = "Not syncing"; chip.title = "Sign in under Data & backup to sync devices"; return; }
    chip.textContent = !navigator.onLine ? "Offline · will sync" : syncing ? "Syncing…" : lastError ? "Sync problem" : "Synced " + ago(lastSync);
    chip.title = lastError || "";
    var st = $("sy-state"); if (st) st.innerHTML = "Signed in as <b>" + esc(user.email) + "</b>. Last sync: " + esc(syncing ? "in progress" : ago(lastSync)) + "." + (lastError ? ' <span class="status err">' + esc(lastError) + "</span>" : "");
  }
  function msg(t, err) { var el = $("sy-status"); if (el) { el.textContent = t || ""; el.classList.toggle("err", !!err); } }

  function render() {
    var host = $("sy-box"); if (!host) return;
    if (!backend) {
      host.innerHTML = '<p class="hint">Sync isn\'t set up for this copy of the app yet. Data stays on this device; use the backup file to move it.</p>';
      setStatus(); return;
    }
    if (recovering && user) {
      host.innerHTML = '<p class="hint">Choose a new password for ' + esc(user.email) + '.</p><div class="fields"><div class="field"><label for="sy-newpw"><b>New password</b></label><input id="sy-newpw" type="password" autocomplete="new-password" minlength="8"></div></div>' +
        '<div class="form-actions"><button type="button" class="primary" id="sy-setpw">Save password</button><span class="status" id="sy-status"></span></div>';
      $("sy-setpw").onclick = function () {
        var pw = $("sy-newpw").value; if (pw.length < 8) { msg("Use at least 8 characters.", true); return; }
        backend.setPassword(pw).then(function () { recovering = false; render(); }).catch(function (e) { msg(e.message || "Couldn't save the password.", true); });
      };
      return;
    }
    if (user) {
      host.innerHTML = '<p class="hint" id="sy-state"></p><div class="form-actions"><button type="button" id="sy-now">Sync now</button><button type="button" id="sy-out">Sign out</button><span class="status" id="sy-status"></span></div>' +
        '<p class="hint">Changes sync automatically when you\'re online. Signing out keeps this device\'s copy of the log.</p>';
      $("sy-now").onclick = function () { syncOnce(); };
      $("sy-out").onclick = function () { backend.signOut().then(function () { user = null; render(); }); };
      setStatus(); return;
    }
    host.innerHTML = '<p class="hint">Sign in to keep this log the same on your phone and computer. Use the same email and password on each device.</p>' +
      '<div class="fields"><div class="field"><label for="sy-email"><b>Email</b></label><input id="sy-email" type="email" autocomplete="email"></div>' +
      '<div class="field"><label for="sy-pw"><b>Password</b></label><input id="sy-pw" type="password" autocomplete="current-password" minlength="8"></div></div>' +
      '<div class="form-actions"><button type="button" class="primary" id="sy-in">Sign in</button><button type="button" id="sy-up">Create account</button><button type="button" id="sy-forgot">Forgot password</button><span class="status" id="sy-status" role="status"></span></div>';
    function creds() { var e = $("sy-email").value.trim(), p = $("sy-pw").value; if (!/^\S+@\S+\.\S+$/.test(e)) { msg("Enter your email address.", true); return null; } return { e: e, p: p }; }
    $("sy-in").onclick = function () { var c = creds(); if (!c) return; msg("Signing in…"); backend.signIn(c.e, c.p).then(function (d) { msg(""); if (d && d.user) handleAuth({ id: d.user.id, email: d.user.email }); }).catch(function (e) { msg(friendly(e), true); }); };
    $("sy-up").onclick = function () {
      var c = creds(); if (!c) return; if (c.p.length < 8) { msg("Use a password of at least 8 characters.", true); return; }
      msg("Creating account…");
      backend.signUp(c.e, c.p).then(function (d) {
        if (d && d.session && d.user) { msg(""); handleAuth({ id: d.user.id, email: d.user.email }); }
        else msg("Check your email for a confirmation link, then come back and sign in.");
      }).catch(function (e) { msg(friendly(e), true); });
    };
    $("sy-forgot").onclick = function () { var e = $("sy-email").value.trim(); if (!/^\S+@\S+\.\S+$/.test(e)) { msg("Enter your email address first.", true); return; } backend.resetPassword(e).then(function () { msg("If that email has an account, a reset link is on its way."); }).catch(function (x) { msg(friendly(x), true); }); };
    setStatus();
  }
  function friendly(e) {
    var m = (e && e.message) || "Something went wrong.";
    if (/invalid login/i.test(m)) return "That email and password don't match an account.";
    if (/not confirmed/i.test(m)) return "Confirm your email first; the link is in your inbox.";
    if (/rate limit/i.test(m)) return "Too many emails sent recently. Wait a while and try again.";
    return m;
  }
  function mountUI() {
    var panel = document.querySelector("#backup > div"); if (!panel) return;
    var sec = document.createElement("div");
    sec.style.cssText = "border-top:1px solid var(--line);padding-top:12px;display:flex;flex-direction:column;gap:8px";
    sec.innerHTML = '<h3 style="font-size:1rem;margin:0">Sync across devices</h3><div id="sy-box"></div>';
    panel.appendChild(sec);
    var meta = document.querySelector("header.top .meta");
    if (meta) { var chip = document.createElement("span"); chip.id = "m-sync"; meta.appendChild(chip); }
    render();
  }

  // ---------- start ----------
  backend = window.__reefTestBackend || (cfg.supabaseUrl && cfg.supabaseKey ? supabaseBackend() : null);
  function start() {
    mountUI();
    if (!backend) return;
    store.onLocalChange(function () { if (user) schedule(); });
    window.addEventListener("online", function () { setStatus(); schedule(0); });
    window.addEventListener("offline", setStatus);
    window.addEventListener("focus", function () { if (user) schedule(300); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden && user) schedule(300); });
    setInterval(function () { if (user && !document.hidden) syncOnce(); else setStatus(); }, 60000);
    store.ready.then(function () { return backend.currentUser(); }).then(function (u) { if (u) handleAuth(u); else render(); }).catch(function (e) { lastError = e.message; render(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.__reefSync = { syncNow: syncOnce, state: function () { return { user: user, lastSync: lastSync, lastError: lastError, syncing: syncing }; } };
})();
