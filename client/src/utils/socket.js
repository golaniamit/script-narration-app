import io from 'socket.io-client';

// Use relative path so it works with the Vite proxy (and thus mobile devices via IP)
const URL = undefined;

export const socket = io(URL, {
    autoConnect: false
});
