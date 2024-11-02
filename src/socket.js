import { io } from 'socket.io-client';

const socket = io("https://calls-2sw9.onrender.com"); // Use your deployed signaling server URL
export default socket;
