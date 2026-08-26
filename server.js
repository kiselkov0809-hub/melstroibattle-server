const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

let rooms = {};
let matchmaking = [];

wss.on('connection', function(ws) {
    ws.on('message', function(msg) {
        try {
            const data = JSON.parse(msg);
            handleMessage(ws, data);
        } catch(e) {}
    });
    
    ws.on('close', function() {
        matchmaking = matchmaking.filter(function(m) { return m.ws !== ws; });
        for (let roomId in rooms) {
            if (rooms[roomId].p1 === ws || rooms[roomId].p2 === ws) {
                const opponent = rooms[roomId].p1 === ws ? rooms[roomId].p2 : rooms[roomId].p1;
                if (opponent) opponent.send(JSON.stringify({ type: 'opponent_left' }));
                delete rooms[roomId];
            }
        }
    });
});

function getCharacterInfo(characterId) {
    let hp = 100;
    let special = null;
    
    if (characterId === 'fog') { hp = 200; special = 'oneShot'; }
    else if (characterId === 'cat') { hp = 300; special = 'crit'; }
    else if (characterId === 'batnost') { hp = 120; special = 'lowHpHeal'; }
    else if (characterId === 'babnost') { special = 'lowHpShield'; }
    else if (characterId === 'mamnost') { special = 'rage'; }
    else if (characterId === 'cheese') { special = 'everySecondBlock'; }
    else if (characterId === 'pakost') { special = 'teleport'; }
    
    return { hp, special };
}

function handleMessage(ws, data) {
    if (data.type === 'join_queue') {
        const info = getCharacterInfo(data.character);
        
        matchmaking.push({ 
            ws: ws, 
            nick: data.nick, 
            character: data.character || 'melstroy',
            maxHP: info.hp,
            special: info.special
        });
        ws.send(JSON.stringify({ type: 'queue_joined' }));
        if (matchmaking.length >= 2) {
            const p1 = matchmaking.shift();
            const p2 = matchmaking.shift();
            const roomId = Date.now();
            const bgKeys = ['alley', 'ring', 'field', 'japan', 'mytishchi', 'novgorod'];
            const rndBg = bgKeys[Math.floor(Math.random() * bgKeys.length)];
            rooms[roomId] = { p1: p1.ws, p2: p2.ws };
            p1.ws.send(JSON.stringify({ 
                type: 'match_found', 
                opponent: p2.nick, 
                side: 'left', 
                opponentCharacter: p2.character,
                opponentMaxHP: p2.maxHP,
                opponentSpecial: p2.special,
                bg: rndBg
            }));
            p2.ws.send(JSON.stringify({ 
                type: 'match_found', 
                opponent: p1.nick, 
                side: 'right', 
                opponentCharacter: p1.character,
                opponentMaxHP: p1.maxHP,
                opponentSpecial: p1.special,
                bg: rndBg
            }));
        }
    }
    
    if (data.type === 'move') {
        for (let roomId in rooms) {
            const room = rooms[roomId];
            if (room.p1 === ws) room.p2.send(JSON.stringify({ type: 'opponent_move', x: data.x }));
            if (room.p2 === ws) room.p1.send(JSON.stringify({ type: 'opponent_move', x: data.x }));
        }
    }
    
    if (data.type === 'attack') {
        for (let roomId in rooms) {
            const room = rooms[roomId];
            if (room.p1 === ws) room.p2.send(JSON.stringify({ type: 'opponent_attack', dmg: data.dmg, hp: data.hp }));
            if (room.p2 === ws) room.p1.send(JSON.stringify({ type: 'opponent_attack', dmg: data.dmg, hp: data.hp }));
        }
    }
    
    if (data.type === 'heal') {
        for (let roomId in rooms) {
            const room = rooms[roomId];
            if (room.p1 === ws) room.p2.send(JSON.stringify({ type: 'opponent_heal', hp: data.hp }));
            if (room.p2 === ws) room.p1.send(JSON.stringify({ type: 'opponent_heal', hp: data.hp }));
        }
    }
    
    if (data.type === 'game_over') {
        for (let roomId in rooms) {
            const room = rooms[roomId];
            if (room.p1 === ws) {
                room.p2.send(JSON.stringify({ type: 'game_result', win: false }));
                delete rooms[roomId];
            }
            if (room.p2 === ws) {
                room.p1.send(JSON.stringify({ type: 'game_result', win: false }));
                delete rooms[roomId];
            }
        }
    }
}

console.log('Server running');                 
