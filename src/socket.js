import { io } from 'socket.io-client';

const socket = io("https://your-signaling-server-url"); // Use your deployed signaling server URL
export default socket;
