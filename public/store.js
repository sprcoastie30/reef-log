/*
 * Reef Log local store.
 * Provides the same small storage interface the app uses (window.claude.use("db" | "assets" | "downloads" | "user")),
 * backed by the browser's IndexedDB so the app runs on its own, on the user's device, with no server.
 * It also records what changed locally, so sync.js can send changes to the cloud and apply changes from other devices.
 * Copyright (c) 2026 Carl Peterson. All rights reserved.
 */
(function () {
  "use strict";
  var DB_NAME = "reeflog", DB_VER = 2;
  var idb = null, memoryOnly = false;
  var docs = new Map(), blobs = new Map(), urls = new Map(), listeners = new Set();
  var meta = new Map();   // doc path -> { u: updated ms, d: 1 if not yet synced, x: 1 if deleted }
  var bmeta = new Map();  // blob id -> { up: 1 if uploaded, del: 1 if deletion not yet synced }
  var kv = new Map();     // small sync settings (cursor, account)
  var changeHooks = new Set();

  function uid() {
    var a = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function merge(base, patch) {
    var out = clone(base) || {};
    Object.keys(patch).forEach(function (k) {
      var v = patch[k];
      if (isObj(v) && v.__delete__ === true) { delete out[k]; return; }
      out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : clone(v);
    });
    return out;
  }
  var lastStamp = 0;
  function stamp() { var t = Date.now(); if (t <= lastStamp) t = lastStamp + 1; lastStamp = t; return t; }

  function openDb() {
    return new Promise(function (res, rej) {
      if (!("indexedDB" in window)) { rej(new Error("IndexedDB unavailable")); return; }
      var r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = function () {
        var d = r.result;
        ["docs", "blobs", "meta", "bmeta", "kv"].forEach(function (n) { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function run(stores, fn) {
    if (memoryOnly || !idb) return Promise.resolve();
    return new Promise(function (res, rej) {
      var t = idb.transaction(stores, "readwrite");
      fn(function (n) { return t.objectStore(n); });
      t.oncomplete = function () { res(); };
      t.onerror = function () { rej(t.error); };
      t.onabort = function () { rej(t.error || new Error("Storage write aborted")); };
    });
  }
  function loadAll() {
    return openDb().then(function (d) {
      idb = d;
      return new Promise(function (res, rej) {
        var names = ["docs", "blobs", "meta", "bmeta", "kv"], maps = [docs, blobs, meta, bmeta, kv];
        var t = idb.transaction(names, "readonly");
        names.forEach(function (n, i) {
          t.objectStore(n).openCursor().onsuccess = function (e) { var c = e.target.result; if (c) { maps[i].set(c.key, c.value); c.continue(); } };
        });
        t.oncomplete = res; t.onerror = function () { rej(t.error); };
      });
    }).then(function () {
      blobs.forEach(function (b, id) { urls.set(id, URL.createObjectURL(b)); });
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    });
  }

  var ready = loadAll().catch(function (e) {
    memoryOnly = true;
    console.warn("Reef Log: on-device storage unavailable, running in memory only.", e);
    document.addEventListener("DOMContentLoaded", function () {
      var n = document.createElement("div");
      n.className = "notice";
      n.textContent = "This browser isn't letting the app save data (private browsing can do this). Anything you enter will be lost when you close the page.";
      var w = document.querySelector(".wrap"); if (w) w.insertBefore(n, w.children[1] || null);
    });
  });

  // ---------- snapshots ----------
  var META = { fromCache: false, hasPendingWrites: false };
  function snapDoc(path) {
    var d = docs.get(path);
    return { id: path.split("/").pop(), exists: d !== undefined, data: function () { return clone(d); }, metadata: META };
  }
  function inCollection(key, col) { return key.indexOf(col + "/") === 0 && key.split("/").length === col.split("/").length + 1; }
  function runQuery(col, order, lim) {
    var arr = [];
    docs.forEach(function (v, k) { if (inCollection(k, col)) arr.push({ k: k, v: v }); });
    if (order) {
      var f = order.f, sign = order.dir === "desc" ? -1 : 1;
      arr.sort(function (a, b) {
        var x = a.v[f], y = b.v[f];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * sign;
      });
    } else {
      arr.sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : 0; });
    }
    if (lim) arr = arr.slice(0, lim);
    var list = arr.map(function (e) { return snapDoc(e.k); });
    return {
      docs: list, size: list.length, empty: !list.length, metadata: META,
      docChanges: function () { return list.map(function (d, i) { return { type: "added", doc: d, oldIndex: -1, newIndex: i }; }); }
    };
  }
  var pending = false;
  function notify() {
    if (pending) return; pending = true;
    setTimeout(function () { pending = false; listeners.forEach(function (l) { try { l(); } catch (e) { console.error(e); } }); }, 0);
  }
  function localChanged() { changeHooks.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  function subscribe(fn) {
    var l = fn; listeners.add(l);
    ready.then(function () { setTimeout(function () { if (listeners.has(l)) l(); }, 0); });
    return function () { listeners.delete(l); };
  }

  // ---------- refs ----------
  function checkDocPath(path) {
    if (typeof path !== "string" || path.split("/").length % 2 !== 0) throw new TypeError("A document path needs an even number of segments: " + path);
  }
  function write(path, data) {
    var m = { u: stamp(), d: 1, x: 0 };
    docs.set(path, data); meta.set(path, m);
    notify();
    return run(["docs", "meta"], function (s) { s("docs").put(data, path); s("meta").put(m, path); }).then(localChanged);
  }
  function remove(path) {
    var m = { u: stamp(), d: 1, x: 1 };
    docs.delete(path); meta.set(path, m);
    notify();
    return run(["docs", "meta"], function (s) { s("docs").delete(path); s("meta").put(m, path); }).then(localChanged);
  }
  function docRef(path) {
    checkDocPath(path);
    return {
      id: path.split("/").pop(), path: path,
      get: function () { return ready.then(function () { return snapDoc(path); }); },
      set: function (data) { return ready.then(function () { return write(path, clone(data)); }); },
      update: function (data) {
        return ready.then(function () {
          if (!docs.has(path)) { var e = new Error("Document does not exist"); e.code = "invalid_argument"; throw e; }
          return write(path, merge(docs.get(path), data));
        });
      },
      delete: function () { return ready.then(function () { return remove(path); }); },
      onSnapshot: function (next) { return subscribe(function () { next(snapDoc(path)); }); },
      collection: function (sub) { return collRef(path + "/" + sub); }
    };
  }
  function makeQuery(col, order, lim) {
    return {
      where: function () { throw new Error("where() is not supported by the local store"); },
      orderBy: function (f, dir) { return makeQuery(col, { f: f, dir: dir || "asc" }, lim); },
      limit: function (n) { return makeQuery(col, order, n); },
      get: function () { return ready.then(function () { return runQuery(col, order, lim); }); },
      onSnapshot: function (next) { return subscribe(function () { next(runQuery(col, order, lim)); }); }
    };
  }
  function collRef(col) {
    var q = makeQuery(col);
    q.path = col;
    q.doc = function (id) { return docRef(col + "/" + (id || uid())); };
    q.add = function (data) { var r = docRef(col + "/" + uid()); return r.set(data).then(function () { return r; }); };
    return q;
  }
  var DB = Object.freeze({ doc: docRef, collection: collRef });

  // ---------- assets (photos) ----------
  function putBlobLocal(id, b, bm) {
    if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
    blobs.set(id, b); urls.set(id, URL.createObjectURL(b)); bmeta.set(id, bm);
    return run(["blobs", "bmeta"], function (s) { s("blobs").put(b, id); s("bmeta").put(bm, id); });
  }
  var ASSETS = Object.freeze({
    upload: function (blob, opts) {
      return ready.then(function () {
        var type = (opts && opts.type) || blob.type || "application/octet-stream";
        var b = blob.type === type ? blob : new Blob([blob], { type: type });
        var id = uid();
        return putBlobLocal(id, b, { up: 0, del: 0 }).then(function () {
          localChanged();
          return { id: id, url: urls.get(id), sizeBytes: b.size, contentType: type };
        }).catch(function (e) {
          blobs.delete(id); bmeta.delete(id);
          var err = new Error("Couldn't store the photo on this device"); err.code = (e && e.name === "QuotaExceededError") ? "quota_exceeded" : "upstream_error"; throw err;
        });
      });
    },
    delete: function (id) {
      return ready.then(function () {
        if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
        var wasUp = bmeta.has(id) && bmeta.get(id).up;
        blobs.delete(id); urls.delete(id);
        var bm = { up: 0, del: wasUp ? 1 : 0 };
        if (bm.del) bmeta.set(id, bm); else bmeta.delete(id);
        return run(["blobs", "bmeta"], function (s) { s("blobs").delete(id); if (bm.del) s("bmeta").put(bm, id); else s("bmeta").delete(id); })
          .then(function () { localChanged(); return { deleted: true }; });
      });
    },
    list: function () {
      return ready.then(function () {
        var list = [], bytes = 0;
        blobs.forEach(function (b, id) { bytes += b.size; list.push({ id: id, url: urls.get(id), contentType: b.type, sizeBytes: b.size, createdAt: "" }); });
        return { assets: list, usage: { files: list.length, bytes: bytes, maxFiles: 0, maxBytes: 0 } };
      });
    }
  });
  window.__blobUrl = function (id) { return urls.get(id) || ""; };

  // ---------- downloads ----------
  var DOWNLOADS = Object.freeze({
    save: function (req) {
      var name = String(req.filename || "download");
      var type = /\.json$/i.test(name) ? "application/json" : /\.csv$/i.test(name) ? "text/csv" : /\.png$/i.test(name) ? "image/png" : /\.ics$/i.test(name) ? "text/calendar" : "application/octet-stream";
      var b = req.data instanceof Blob ? req.data : new Blob([req.data], { type: type });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = name; a.rel = "noopener";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return Promise.resolve({ status: "saved" });
    }
  });

  // ---------- user (single local owner) ----------
  var USER = Object.freeze({
    isOwner: function () { return Promise.resolve(true); },
    canEdit: function () { return Promise.resolve(true); },
    can: function () { return Promise.resolve(true); },
    id: function () { return Promise.resolve("local"); },
    me: function () { return Promise.resolve({ id: "local", name: "", email: null }); },
    profiles: function () { return Promise.resolve({}); }
  });

  var CAPS = { db: DB, assets: ASSETS, downloads: DOWNLOADS, user: USER };
  window.claude = Object.freeze({ use: function (name) { return ready.then(function () { return CAPS[name] || null; }); } });

  // ---------- sync hooks (used by sync.js) ----------
  window.__reefStore = Object.freeze({
    ready: ready,
    onLocalChange: function (f) { changeHooks.add(f); return function () { changeHooks.delete(f); }; },
    // Documents changed on this device and not yet sent. Records from before change tracking count as unsent.
    dirtyDocs: function () {
      var out = [];
      docs.forEach(function (v, k) { var m = meta.get(k); if (!m || m.d) out.push({ path: k, data: clone(v), u: m ? m.u : 1, deleted: false }); });
      meta.forEach(function (m, k) { if (m.x && m.d) out.push({ path: k, data: null, u: m.u, deleted: true }); });
      return out;
    },
    markClean: function (path, u) {
      var m = meta.get(path);
      var nm = m ? { u: m.u, d: m.u === u ? 0 : m.d, x: m.x } : { u: u, d: 0, x: 0 };
      meta.set(path, nm);
      return run(["meta"], function (s) { s("meta").put(nm, path); });
    },
    // A change from another device. Kept only if it is newer than what this device has.
    applyRemote: function (path, data, u, deleted) {
      checkDocPath(path);
      var m = meta.get(path);
      if (m && m.u >= u) return Promise.resolve(false);
      var nm = { u: u, d: 0, x: deleted ? 1 : 0 };
      meta.set(path, nm);
      if (deleted) docs.delete(path); else docs.set(path, clone(data));
      notify();
      return run(["docs", "meta"], function (s) { if (deleted) s("docs").delete(path); else s("docs").put(data, path); s("meta").put(nm, path); })
        .then(function () { return true; });
    },
    photoAssetIds: function () {
      var ids = [];
      docs.forEach(function (v) { if (v && typeof v.asset === "string" && v.asset && ids.indexOf(v.asset) < 0) ids.push(v.asset); });
      return ids;
    },
    blobsToUpload: function () {
      var ids = [];
      blobs.forEach(function (b, id) { var bm = bmeta.get(id); if (!bm || !bm.up) ids.push(id); });
      return ids;
    },
    blobsToDelete: function () { var ids = []; bmeta.forEach(function (bm, id) { if (bm.del) ids.push(id); }); return ids; },
    hasBlob: function (id) { return blobs.has(id); },
    getBlob: function (id) { return blobs.get(id) || null; },
    putRemoteBlob: function (id, b) { return putBlobLocal(id, b, { up: 1, del: 0 }).then(notify); },
    markBlobUploaded: function (id) { if (!blobs.has(id)) return Promise.resolve(); var bm = { up: 1, del: 0 }; bmeta.set(id, bm); return run(["bmeta"], function (s) { s("bmeta").put(bm, id); }); },
    markBlobDeleted: function (id) { bmeta.delete(id); return run(["bmeta"], function (s) { s("bmeta").delete(id); }); },
    getKV: function (k) { return kv.get(k); },
    setKV: function (k, v) { if (v === undefined) kv.delete(k); else kv.set(k, v); return run(["kv"], function (s) { if (v === undefined) s("kv").delete(k); else s("kv").put(v, k); }); },
    // Forget sync state (used when signing out or switching accounts): everything local counts as unsent again.
    resetSyncState: function () {
      meta.forEach(function (m, k) { if (m.x) meta.delete(k); });
      var nm = new Map(); docs.forEach(function (v, k) { nm.set(k, { u: (meta.get(k) || {}).u || 1, d: 1, x: 0 }); });
      meta = nm; bmeta.clear(); blobs.forEach(function (b, id) { bmeta.set(id, { up: 0, del: 0 }); });
      kv.delete("cursor");
      return run(["meta", "bmeta", "kv"], function (s) {
        s("meta").clear(); meta.forEach(function (m, k) { s("meta").put(m, k); });
        s("bmeta").clear(); bmeta.forEach(function (m, k) { s("bmeta").put(m, k); });
        s("kv").delete("cursor");
      });
    }
  });

  // ---------- restore from a backup file ----------
  function dataUrlToBlob(u) {
    var m = /^data:([^;,]*)(;base64)?,(.*)$/.exec(u);
    if (!m) throw new Error("Bad photo data in backup");
    var raw = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: m[1] || "application/octet-stream" });
  }
  window.__reefRestore = function (backup) {
    if (!backup || backup.app !== "reef-log" || !Array.isArray(backup.docs)) return Promise.reject(new Error("Not a Reef Log backup"));
    var newDocs = new Map(), newBlobs = new Map();
    backup.docs.forEach(function (d) { checkDocPath(d.path); newDocs.set(d.path, clone(d.data)); });
    Object.keys(backup.blobs || {}).forEach(function (id) { newBlobs.set(id, dataUrlToBlob(backup.blobs[id])); });
    return ready.then(function () {
      if (memoryOnly || !idb) throw new Error("This browser isn't allowing on-device storage");
      var now = stamp();
      return new Promise(function (res, rej) {
        var names = ["docs", "blobs", "meta", "bmeta", "kv"];
        var t = idb.transaction(names, "readwrite");
        var ds = t.objectStore("docs"), bs = t.objectStore("blobs"), ms = t.objectStore("meta"), bms = t.objectStore("bmeta");
        ds.clear(); bs.clear(); ms.clear(); bms.clear(); t.objectStore("kv").delete("cursor");
        // Restored records are newer than anything else, so they win when this device next syncs.
        newDocs.forEach(function (v, k) { ds.put(v, k); ms.put({ u: now, d: 1, x: 0 }, k); });
        newBlobs.forEach(function (v, k) { bs.put(v, k); bms.put({ up: 0, del: 0 }, k); });
        t.oncomplete = res; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error || new Error("Restore aborted")); };
      });
    });
  };
  window.__standalone = true;
})();
