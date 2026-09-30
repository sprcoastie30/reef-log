/*
 * Reef Log local store.
 * Provides the same small storage interface the app uses (window.claude.use("db" | "assets" | "downloads" | "user")),
 * backed by the browser's IndexedDB so the app runs on its own, on the user's device, with no server.
 * Copyright (c) 2026 Carl Peterson. All rights reserved.
 */
(function () {
  "use strict";
  var DB_NAME = "reeflog", DB_VER = 1;
  var idb = null, memoryOnly = false;
  var docs = new Map(), blobs = new Map(), urls = new Map(), listeners = new Set();

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

  function openDb() {
    return new Promise(function (res, rej) {
      if (!("indexedDB" in window)) { rej(new Error("IndexedDB unavailable")); return; }
      var r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains("docs")) d.createObjectStore("docs");
        if (!d.objectStoreNames.contains("blobs")) d.createObjectStore("blobs");
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function run(store, mode, fn) {
    if (memoryOnly || !idb) return Promise.resolve();
    return new Promise(function (res, rej) {
      var t = idb.transaction(store, mode);
      fn(t.objectStore(store));
      t.oncomplete = function () { res(); };
      t.onerror = function () { rej(t.error); };
      t.onabort = function () { rej(t.error || new Error("Storage write aborted")); };
    });
  }
  function loadAll() {
    return openDb().then(function (d) {
      idb = d;
      return new Promise(function (res, rej) {
        var t = idb.transaction(["docs", "blobs"], "readonly");
        t.objectStore("docs").openCursor().onsuccess = function (e) { var c = e.target.result; if (c) { docs.set(c.key, c.value); c.continue(); } };
        t.objectStore("blobs").openCursor().onsuccess = function (e) { var c = e.target.result; if (c) { blobs.set(c.key, c.value); c.continue(); } };
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
    docs.set(path, data);
    notify();
    return run("docs", "readwrite", function (s) { s.put(data, path); });
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
      delete: function () {
        return ready.then(function () { docs.delete(path); notify(); return run("docs", "readwrite", function (s) { s.delete(path); }); });
      },
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
  var ASSETS = Object.freeze({
    upload: function (blob, opts) {
      return ready.then(function () {
        var type = (opts && opts.type) || blob.type || "application/octet-stream";
        var b = blob.type === type ? blob : new Blob([blob], { type: type });
        var id = uid();
        blobs.set(id, b); urls.set(id, URL.createObjectURL(b));
        return run("blobs", "readwrite", function (s) { s.put(b, id); }).then(function () {
          return { id: id, url: urls.get(id), sizeBytes: b.size, contentType: type };
        }).catch(function (e) {
          blobs.delete(id);
          var err = new Error("Couldn't store the photo on this device"); err.code = (e && e.name === "QuotaExceededError") ? "quota_exceeded" : "upstream_error"; throw err;
        });
      });
    },
    delete: function (id) {
      return ready.then(function () {
        if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
        blobs.delete(id); urls.delete(id);
        return run("blobs", "readwrite", function (s) { s.delete(id); }).then(function () { return { deleted: true }; });
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
      var type = /\.json$/i.test(name) ? "application/json" : /\.csv$/i.test(name) ? "text/csv" : /\.png$/i.test(name) ? "image/png" : "application/octet-stream";
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
      return new Promise(function (res, rej) {
        var t = idb.transaction(["docs", "blobs"], "readwrite");
        var ds = t.objectStore("docs"), bs = t.objectStore("blobs");
        ds.clear(); bs.clear();
        newDocs.forEach(function (v, k) { ds.put(v, k); });
        newBlobs.forEach(function (v, k) { bs.put(v, k); });
        t.oncomplete = res; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error || new Error("Restore aborted")); };
      });
    });
  };
  window.__standalone = true;
})();
