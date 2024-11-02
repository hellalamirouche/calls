import { io } from 'socket.io-client';

const socket = io("https://servcall.onrender.com/");// Use your deployed signaling server URL
export default socket;
