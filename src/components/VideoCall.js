import React, { useRef, useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

      // Create RTCPeerConnection
      peerConnection.current = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.relay.metered.ca:80" },
          { urls: "turn:global.relay.metered.ca:80", username: "634a97cd60f30f180d841ff9", credential: "HHPfoiWUeqgz/imf" },
          { urls: "turn:global.relay.metered.ca:443", username: "634a97cd60f30f180d841ff9", credential: "HHPfoiWUeqgz/imf" },
          { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: "634a97cd60f30f180d841ff9", credential: "HHPfoiWUeqgz/imf" }
        ]
      });

      // Set up event handlers
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", event.candidate, roomId);
        }
      };

      peerConnection.current.ontrack = (event) => {
        remoteVideoRef.current.srcObject = event.streams[0];
      };

      // Get user media with fallback options
      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
      } catch (mediaError) {
        // Try fallback to just audio if video fails
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

      // Add tracks to peer connection
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
    // ... (previous socket event handlers remain the same)

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
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Online Users: {onlineCount}</h2>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <Input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          disabled={isLoading}
        />
        
        <div className="flex gap-4">
          <Button 
            onClick={joinRoom} 
            disabled={isConnected || isLoading}
            className="w-full"
          >
            {isLoading ? 'Connecting...' : 'Join Room'}
          </Button>
          <Button 
            onClick={createRoom}
            disabled={isLoading}
            className="w-full"
          >
            Create Room
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded">
            You
          </div>
        </div>
        <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded">
            Remote
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;