/* Multiplayer peer-to-peer (WebRTC con Trystero): nessun server tuo, funziona anche su GitHub Pages.
   Due persone che scrivono lo stesso codice stanza entrano nello stesso presepe e si vedono con il cappello. */
import { joinRoom } from "./vendor/trystero.js";

export const NET_APP_ID = "isiss-matese-nativita-ar";

export function connectNet(roomId, { onPeerState, onPeerJoin, onPeerLeave }){
  const room = joinRoom({ appId: NET_APP_ID }, roomId);
  const pos = room.makeAction("pos");                 // [x, y, z, yaw, pitch] della testa, nelle coordinate del presepe
  pos.onMessage = (d, meta) => { const id = meta && meta.peerId !== undefined ? meta.peerId : meta; if (Array.isArray(d) && d.length === 5) onPeerState(id, d); };
  room.onPeerJoin = id => onPeerJoin(id);
  room.onPeerLeave = id => onPeerLeave(id);
  return {
    send: d => { try { pos.send(d); } catch (e) {} },
    leave: () => { try { room.leave(); } catch (e) {} }
  };
}
