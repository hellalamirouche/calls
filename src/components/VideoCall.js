import React, { useRef, useState, useEffect } from 'react';
import socket from '../socket';

const VideoCall = () => {
  const [roomId, setRoomId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const localStream = useRef(null);

  const checkMediaPermissions = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      const hasAudio = devices.some(device => device.kind === 'audioinput');
      
      if (!hasVideo && !hasAudio) {
        throw new Error('No camera or microphone detected on your device.');
      }
      
      return true;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  };

  const startConnection = async () => {
    if (peerConnection.current) {
      setError('Already connected to a room');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const hasPermissions = await checkMediaPermissions();
      if (!hasPermissions) {
        throw new Error('Please ensure your device has a camera and microphone.');
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
        localStream.current = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
      } catch (mediaError) {
        try {
          console.log('Failed to get video, trying audio only');
          localStream.current = await navigator.mediaDevices.getUserMedia({ 
            video: false, 
            audio: true 
          });
          setError('Video access denied. Connected with audio only.');
        } catch (audioError) {
          throw new Error('Unable to access camera or microphone. Please check your browser permissions and make sure your devices are properly connected.');
        }
      }

      localStream.current.getTracks().forEach(track => 
        peerConnection.current.addTrack(track, localStream.current)
      );
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream.current;
      }

    } catch (error) {
      setError(error.message);
      cleanupConnection();
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupConnection = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const joinRoom = async () => {
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }
    await startConnection();
    if (!error) {
      socket.emit("join-room", roomId);
      setIsConnected(true);
    }
  };

  const createRoom = async () => {
    const newRoomId = Math.random().toString(36).substr(2, 9);
    setRoomId(newRoomId);
    socket.emit("create-room", newRoomId);
    await joinRoom();
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

    socket.on("room-joined", (count) => setOnlineCount(count));
    socket.on("user-joined", (count) => setOnlineCount(count));
    socket.on("user-left", (count) => setOnlineCount(count));

    return () => {
      cleanupConnection();
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("room-joined");
      socket.off("user-joined");
      socket.off("user-left");
    };
  }, [roomId]);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px' }}>Online Users: {onlineCount}</h2>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: '4px',
          marginBottom: '20px',
          color: '#dc2626'
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }}
        />
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={joinRoom}
            disabled={isConnected || isLoading}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: isConnected || isLoading ? '#ccc' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isConnected || isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Connecting...' : 'Join Room'}
          </button>
          <button
            onClick={createRoom}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: isLoading ? '#ccc' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            Create Room
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '20px' 
      }}>
        <div style={{ position: 'relative', aspectRatio: '16/9', backgroundColor: '#f3f4f6', borderRadius: '8px', overflow: 'hidden' }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            You
          </div>
        </div>
        <div style={{ position: 'relative', aspectRatio: '16/9', backgroundColor: '#f3f4f6', borderRadius: '8px', overflow: 'hidden' }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            Remote
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;