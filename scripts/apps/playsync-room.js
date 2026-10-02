/*
 * PlaySync's room, played inside the app for the portfolio's live preview. vendor.mjs inlines it after
 * the bridge in public/apps/playsync/index.html; it's inert outside the portfolio.
 *
 * The real app talks to its server over a WebSocket (/ws). Inside the portfolio there's no server, so
 * this stands in for one room:
 * - It opens as the room was at the moment the live app boots from (a checkpoint of the tape): its
 *   state, chat and people, rebuilt from what the scene's socket received, and rebased on the app's
 *   clock (the bridge's), so positions and chat times line up.
 * - What the other participant said later in the scene arrives at the same moments, on that clock.
 * - What the visitor does gets the answers the server would give: their own chat messages, play,
 *   pause, seek, the queue. In a room of two, the visitor is the host.
 */
(function () {
  var handoff;
  try {
    handoff = window.parent !== window && window.parent.__live && window.parent.__live[document.currentScript.dataset.app];
  } catch (e) {}
  if (!handoff || !handoff.socket) return;

  var rec = handoff.socket.in.map(function (x) {
    return { t: x[0], m: JSON.parse(x[1]) };
  });
  var at = handoff.at || 0;

  // ---- The room as the scene saw it at `at`
  var you = null;
  var state = null;
  var chat = [];
  var people = [];
  var sync = null; // a tape time and the server's clock then
  rec.forEach(function (r) {
    if (r.t > at) return;
    var m = r.m;
    if (m.type === 'welcome') {
      you = m.you;
      state = m.state;
      chat = m.chat.slice();
      people = m.participants;
      sync = { t: r.t, server: m.state.serverTime };
    } else if (m.type === 'state') {
      state = m.state;
      sync = { t: r.t, server: m.state.serverTime };
    } else if (m.type === 'chat') chat.push(m.message);
    else if (m.type === 'participants') people = m.participants;
  });
  if (!state) return;

  // The recorded server's clock, moved onto this app's clock (Date is the bridge's).
  var serverAtBoot = sync.server + (at - sync.t);
  var shift = Date.now() - serverAtBoot;
  state = Object.assign({}, state, {
    position: state.position + (state.isPlaying ? (serverAtBoot - state.lastUpdatedAt) / 1000 : 0),
    lastUpdatedAt: Date.now(),
    serverTime: Date.now(),
  });
  chat = chat.map(function (c) {
    return Object.assign({}, c, { at: c.at + shift });
  });
  var me = people.filter(function (p) {
    return p.id === you;
  })[0];
  var myName = me ? me.name : 'You';
  // Later in the scene: what the others said.
  var later = rec.filter(function (r) {
    return r.t > at && r.m.type === 'chat' && r.m.message.from !== you;
  });
  var seq = 0;
  var scheduled = false;

  // ---- The server's answers
  var now = function () {
    return Date.now();
  };
  var position = function () {
    return state.position + (state.isPlaying ? (now() - state.lastUpdatedAt) / 1000 : 0);
  };
  var send = function (ws, msg) {
    if (ws.readyState === 1) ws._emit('message', { data: JSON.stringify(msg) });
  };
  var update = function (ws, patch) {
    state = Object.assign({}, state, { position: position() }, patch, { lastUpdatedAt: now(), serverTime: now() });
    send(ws, { type: 'state', state: state });
  };
  var say = function (ws, message) {
    chat.push(message);
    send(ws, { type: 'chat', message: message });
  };
  var answer = function (ws, m) {
    var q;
    switch (m.type) {
      case 'join':
        send(ws, { type: 'welcome', you: you, state: Object.assign({}, state, { position: position(), lastUpdatedAt: now(), serverTime: now() }), chat: chat, participants: people });
        if (scheduled) return;
        scheduled = true;
        later.forEach(function (r) {
          setTimeout(function () {
            say(ws, Object.assign({}, r.m.message, { at: now() }));
          }, r.t - at);
        });
        return;
      case 'ping':
        return send(ws, { type: 'pong', t0: m.t0, t1: now() });
      case 'sync-request':
        return send(ws, { type: 'state', state: Object.assign({}, state, { serverTime: now() }) });
      case 'chat':
        var message = { id: 'local-' + ++seq, from: you, name: myName, text: m.text || '', at: now() };
        if (m.media) message.media = m.media;
        return say(ws, message);
      case 'play':
        return update(ws, { isPlaying: true, ended: false });
      case 'pause':
        return update(ws, { isPlaying: false });
      case 'seek':
        return update(ws, { position: Math.max(0, Number(m.position) || 0) });
      case 'load':
        return update(ws, { videoId: m.videoId, videoTitle: m.title || null, media: null, position: 0, isPlaying: m.autoplay !== false, ended: false });
      case 'queue-add':
        return update(ws, { queue: state.queue.concat([{ videoId: m.videoId, title: m.title, addedBy: myName }]) });
      case 'queue-remove':
        q = state.queue.slice();
        q.splice(m.index, 1);
        return update(ws, { queue: q });
      case 'queue-jump':
        var item = state.queue[m.index];
        if (!item) return;
        return update(ws, {
          videoId: item.videoId || null,
          videoTitle: item.title || null,
          media: item.media || null,
          position: 0,
          isPlaying: true,
          ended: false,
          queue: state.queue.filter(function (_, i) {
            return i !== m.index;
          }),
        });
      case 'ended':
        var next = state.queue[0];
        if (next) return update(ws, { videoId: next.videoId || null, videoTitle: next.title || null, media: next.media || null, position: 0, isPlaying: true, queue: state.queue.slice(1) });
        return update(ws, { isPlaying: false, ended: true });
      case 'rename':
        myName = m.name;
        people = people.map(function (p) {
          return p.id === you ? Object.assign({}, p, { name: m.name }) : p;
        });
        return send(ws, { type: 'participants', participants: people });
      default:
        return; // control requests and grants: the visitor is the host already
    }
  };

  // ---- A WebSocket for /ws that talks to this room (any other socket is a real one)
  var RealWebSocket = window.WebSocket;
  function RoomSocket(url) {
    this.url = String(url);
    this.readyState = 0;
    this.protocol = '';
    this.extensions = '';
    this.bufferedAmount = 0;
    this.binaryType = 'blob';
    this.onopen = this.onmessage = this.onclose = this.onerror = null;
    this._listeners = {};
    var self = this;
    setTimeout(function () {
      self.readyState = 1;
      self._emit('open', {});
    }, 0);
  }
  RoomSocket.CONNECTING = 0;
  RoomSocket.OPEN = 1;
  RoomSocket.CLOSING = 2;
  RoomSocket.CLOSED = 3;
  RoomSocket.prototype.addEventListener = function (type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  };
  RoomSocket.prototype.removeEventListener = function (type, fn) {
    this._listeners[type] = (this._listeners[type] || []).filter(function (f) {
      return f !== fn;
    });
  };
  RoomSocket.prototype._emit = function (type, ev) {
    ev.type = type;
    ev.target = ev.currentTarget = this;
    if (typeof this['on' + type] === 'function') this['on' + type](ev);
    var self = this;
    (this._listeners[type] || []).slice().forEach(function (fn) {
      fn.call(self, ev);
    });
  };
  RoomSocket.prototype.send = function (data) {
    var self = this;
    var m;
    try {
      m = JSON.parse(data);
    } catch (e) {
      return;
    }
    setTimeout(function () {
      answer(self, m);
    }, 0);
  };
  RoomSocket.prototype.close = function () {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this._emit('close', { code: 1000, reason: '', wasClean: true });
  };
  window.WebSocket = function (url, protocols) {
    var u = new URL(url, location.href);
    if (/\/ws$/.test(u.pathname)) return new RoomSocket(url);
    return protocols === undefined ? new RealWebSocket(url) : new RealWebSocket(url, protocols);
  };
  window.WebSocket.CONNECTING = 0;
  window.WebSocket.OPEN = 1;
  window.WebSocket.CLOSING = 2;
  window.WebSocket.CLOSED = 3;
})();
