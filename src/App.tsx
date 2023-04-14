import {addDoc, collection, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import {useRef, useState} from 'react'
import './App.css'

import {firestore} from './firebase.config'

const configuration = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
            ],
        },
    ],
    iceCandidatePoolSize: 10,
};

function App() {
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const [localStream, setLocalStream] = useState<MediaStream>()

    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const [remoteStream, setRemoteStream] = useState<MediaStream>()

    const [cameraOpen, setCameraOpen] = useState<boolean>(false)

    const [roomId, setRoomId] = useState<string>();

    async function openUserMedia() {
        localVideoRef.current!.srcObject = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        setLocalStream(localVideoRef.current!.srcObject)

        remoteVideoRef.current!.srcObject = new MediaStream();
        setRemoteStream(remoteVideoRef.current!.srcObject)
        setCameraOpen(true)
    }


    async function createRoom() {
        const db = firestore;
        const roomRef = await addDoc(collection(db, 'rooms'), {});

        console.log('Create PeerConnection with configuration: ', configuration);
        let rtcPeerConnection = new RTCPeerConnection(configuration);

        registerPeerConnectionListeners(rtcPeerConnection);

        localStream!.getTracks().forEach(track => {
            rtcPeerConnection!.addTrack(track, localStream!);
        });

        // Code for collecting ICE candidates below
        const callerCandidatesCollection = collection(roomRef, 'callerCandidates');

        rtcPeerConnection!.addEventListener('icecandidate', event => {
            if (!event.candidate) {
                console.log('Got final candidate!');
                return;
            }
            console.log('Got candidate: ', event.candidate);
            addDoc(callerCandidatesCollection, event.candidate.toJSON());
        });
        // Code for collecting ICE candidates above

        // Code for creating a room below
        const offer = await rtcPeerConnection!.createOffer();
        await rtcPeerConnection!.setLocalDescription(offer);
        console.log('Created offer:', offer);

        const roomWithOffer = {
            'offer': {
                type: offer.type,
                sdp: offer.sdp,
            },
        };
        await setDoc(roomRef, roomWithOffer);
        setRoomId(roomRef.id);
        console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);

        rtcPeerConnection!.addEventListener('track', event => {
            console.log('Got remote track:', event.streams[0]);
            event.streams[0].getTracks().forEach(track => {
                console.log('Add a track to the remoteStream:', track);
                remoteStream!.addTrack(track);
            });
        });

        // Listening for remote session description below
        onSnapshot(roomRef, async snapshot => {
            const data = snapshot.data();
            if (!rtcPeerConnection!.currentRemoteDescription && data && data.answer) {
                console.log('Got remote description: ', data.answer);
                const rtcSessionDescription = new RTCSessionDescription(data.answer);
                await rtcPeerConnection!.setRemoteDescription(rtcSessionDescription);
            }
        });
        // Listening for remote session description above

        // Listen for remote ICE candidates below
        onSnapshot(collection(roomRef, 'calleeCandidates'), snapshot => {
            snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    let data = change.doc.data();
                    console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                    await rtcPeerConnection!.addIceCandidate(new RTCIceCandidate(data));
                }
            });
        });
        // Listen for remote ICE candidates above
    }

    async function joinRoom() {
        let roomId = await prompt("RoomId ?", "");
        await joinRoomById(roomId!);
    }

    async function joinRoomById(roomId: string) {
        const db = firestore;
        const roomRef = await doc(db, `rooms/${roomId}`);
        const roomSnapshot = await getDoc(roomRef);
        console.log('Got room:', roomSnapshot.exists);

        if (roomSnapshot.exists()) {
            console.log('Create PeerConnection with configuration: ', configuration);
            const peerConnection = new RTCPeerConnection(configuration);
            registerPeerConnectionListeners(peerConnection);
            localStream!.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream!);
            });

            // Code for collecting ICE candidates below
            const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');
            peerConnection.addEventListener('icecandidate', event => {
                if (!event.candidate) {
                    console.log('Got final candidate!');
                    return;
                }
                console.log('Got candidate: ', event.candidate);
                addDoc(calleeCandidatesCollection, event.candidate.toJSON());
            });
            // Code for collecting ICE candidates above

            peerConnection.addEventListener('track', event => {
                console.log('Got remote track:', event.streams[0]);
                event.streams[0].getTracks().forEach(track => {
                    console.log('Add a track to the remoteStream:', track);
                    remoteStream!.addTrack(track);
                });
            });

            // Code for creating SDP answer below
            const offer = roomSnapshot.data().offer;
            console.log('Got offer:', offer);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            console.log('Created answer:', answer);
            await peerConnection.setLocalDescription(answer);

            const roomWithAnswer = {
                answer: {
                    type: answer.type,
                    sdp: answer.sdp,
                },
            };
            await updateDoc(roomRef, roomWithAnswer);
            // Code for creating SDP answer above

            // Listening for remote ICE candidates below
            onSnapshot(collection(roomRef, 'callerCandidates'), snapshot => {
                snapshot.docChanges().forEach(async change => {
                    if (change.type === 'added') {
                        let data = change.doc.data();
                        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
                    }
                });
            });
            // Listening for remote ICE candidates above
        }
    }

    function registerPeerConnectionListeners(conn: RTCPeerConnection) {
        conn!.addEventListener('icegatheringstatechange', () => {
            console.log(
                `ICE gathering state changed: ${conn!.iceGatheringState}`);
        });

        conn!.addEventListener('connectionstatechange', () => {
            console.log(`Connection state change: ${conn!.connectionState}`);
        });

        conn!.addEventListener('signalingstatechange', () => {
            console.log(`Signaling state change: ${conn!.signalingState}`);
        });

        conn!.addEventListener('iceconnectionstatechange ', () => {
            console.log(
                `ICE connection state change: ${conn!.iceConnectionState}`);
        });
    }


    return (
        <div className="App">
            <button className="mdc-button mdc-button--raised"
                    disabled={cameraOpen}
                    onClick={openUserMedia}>
                <span className="mdc-button__label">Open camera & microphone</span>
            </button>
            <button className="mdc-button mdc-button--raised"
                    disabled={!cameraOpen}
                    onClick={createRoom}
                    id="createBtn">
                <span className="mdc-button__label">Create room</span>
            </button>
            <button className="mdc-button mdc-button--raised"
                    disabled={!cameraOpen}
                    onClick={joinRoom}
                    id="joinBtn">
                <span className="mdc-button__label">Join room</span>
            </button>
            <button className="mdc-button mdc-button--raised" disabled={!cameraOpen} id="hangupBtn">
                <span className="mdc-button__label">Hangup</span>
            </button>

            <p>Current room id : ${roomId}</p>

            <div>
                <video id="localVideo" ref={localVideoRef} muted autoPlay playsInline></video>
                <video id="remoteVideo" ref={remoteVideoRef} muted autoPlay playsInline></video>
            </div>
        </div>
    )
}

export default App;
