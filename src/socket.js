import { io } from 'socket.io-client';

const socket = io("https://calls-iota.vercel.app"); // Use your deployed signaling server URL
export default socket;
