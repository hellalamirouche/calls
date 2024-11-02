import React, { useRef, useState, useEffect } from 'react';
import socket from '../socket';

const VideoCall = () => {
  const [roomId, setRoomId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const localStream = useRef(null); // To keep track of local stream

  const startConnection = async () => {
    if (peerConnection.current) {
      console.warn('Already connected to a room');
      return;
    }

    peerConnection.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.relay.metered.ca:80" },
        { urls: "turn:global.relay.metered.ca:80", username: "634a97cd60f30f180d841ff9", credential: "HHPfoiWUeqgz/imf" },
        { urls: "turn:global.relay.metered.ca:443", username: "634a97cd60f30f180d841ff9", credential: "HHPfoiWUeqgz/imf" },
        { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: "634a97cd60f30f180d841ff9", credential: "HHPfoiWUeqgz/imf" }
      ]
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate, roomId);
      }
    };

    peerConnection.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log(devices); // Log available devices

      localStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current.getTracks().forEach(track => peerConnection.current.addTrack(track, localStream.current));
      localVideoRef.current.srcObject = localStream.current;
    } catch (error) {
     // console.error("Error accessing media devices: ", error);
      alert("Unable to access camera/microphone. Please check permissions.");
    }
  };

  const joinRoom = async () => {
    await startConnection();
    socket.emit("join-room", roomId);
    setIsConnected(true);
  };

  useEffect(() => {
    socket.on("offer", async (offer) => {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit("answer", answer, roomId);
    });

    socket.on("answer", async (answer) => {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("ice-candidate", async (candidate) => {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      // Cleanup on unmount
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
      }
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate"); //dsfidhsfjh
    };
  }, [roomId]); // Run this effect when roomId changes

  return (
    <div>
      <input
        type="text"
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      />
      <button onClick={joinRoom} disabled={isConnected}>Join Room</button>
      <div>
        <video ref={localVideoRef} autoPlay playsInline muted />
        <video ref={remoteVideoRef} autoPlay playsInline />
      </div>
    </div>
  );
};

export default VideoCall;
