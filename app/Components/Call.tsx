import { useState, useRef, useEffect } from 'react';
import { KeyboardAvoidingView, SafeAreaView, StyleSheet, View, Button, TextInput } from 'react-native';
import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    RTCView,
    MediaStream,
    mediaDevices,
} from 'react-native-webrtc';
import firestore from '@react-native-firebase/firestore';
import React from 'react';

const servers = {
    iceServers: [
        {
        urls: [
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
        ],
        },
    ],
    iceCandidatePoolSize: 10
};
export default function Call () {
    const ref = useRef<RTCPeerConnection>();
    const [remoteStream, setRemoteStream] = useState<MediaStream>();
    const [localStream, setLocalStream] = useState<MediaStream>();
    const [channelId, setChannelId] = useState<string>();
    const [error, setError] = useState<string>('');

    useEffect(() => {
        setUp().then(() => {
            console.log('Finished setup');
        }).catch(err => console.error(err));
    }, []);

    const setUp = async () => {
        ref.current = new RTCPeerConnection(servers);
        const local = await mediaDevices.getUserMedia({
            video: false,
            audio: true,
        }) as MediaStream;
        ref.current.addStream(local);
        setLocalStream(local);
        const remote = new MediaStream(undefined);
        setRemoteStream(remote);

        // Push tracks from local stream to peer connection
        local.getTracks().forEach(track => {
            if (ref.current) {
                ref.current.getLocalStreams()[0].addTrack(track);
            }
        });

        // Pull tracks from peer connection, add to remote video stream
        ref.current.ontrack = (event: any) => {
            event.streams[0].getTracks().forEach((track: any) => {
            remote.addTrack(track);
            });
        };

        ref.current.onaddstream = (event: any) => {
            setRemoteStream(event.stream);
        };
    }

    // ** UNUSED FOR NOW **
    // const startCall = async () => {
    //     const channelDoc = firestore().collection('channels').doc();
    //     const answerCandidates = channelDoc.collection('answerCandidates');

    //     ref.current.onicecandidate = async (event: any) => {
    //       if (event.candidate) {
    //         await answerCandidates.add(event.candidate.toJSON());
    //       }
    //     };

    //     const offerDescription = await ref.current.createOffer();
    //     await ref.current.setLocalDescription(offerDescription);

    //     const offer = {
    //         sdp: offerDescription.sdp,
    //         type: offerDescription.type
    //     };

    //     await channelDoc.set({ offer });

    //     channelDoc.onSnapshot(snapshot => {
    //         const data = snapshot.data();
    //         if (!ref.current.currentRemoteDescription && data?.answer) {
    //             const answerDescription = new RTCSessionDescription(data.answer);
    //             ref.current.setRemoteDescription(answerDescription);
    //         }
    //     });

    //     answerCandidates.onSnapshot((snapshot) => {
    //         snapshot.docChanges().forEach((change) => {
    //             if (change.type === 'added') {
    //                 const candidate = new RTCIceCandidate(change.doc.data());
    //                 ref.current.addIceCandidate(candidate);
    //             }
    //         })
    //     });
    // }

    const joinCall = async () => {
        if (!channelId) {
            setError('Call ID is required to join a call');
            return;
        }
        const channelDoc = firestore().collection('channels').doc(channelId);
        const offerCandidates = channelDoc.collection('offerCandidates');
        const answerCandidates = channelDoc.collection('answerCandidates');

        if (ref.current) {
            ref.current.onicecandidate = async (event: any) => {
            if (event.candidate) {
                await answerCandidates.add(event.candidate.toJSON());
            }
            };
        }

        const channelDocument = await channelDoc.get();
        const channelData = channelDocument.data();

        const offerDescription = channelData?.offer;

        await ref?.current?.setRemoteDescription(
            new RTCSessionDescription(offerDescription),
        );

        const answerDescription = await ref?.current?.createAnswer() as RTCSessionDescription;
        await ref?.current?.setLocalDescription(answerDescription);

        const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
        };

        await channelDoc.update({answer});

        offerCandidates.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const data = change.doc.data();
                ref?.current?.addIceCandidate(new RTCIceCandidate(data));
            }
            });
        });
    }

    return (
        <KeyboardAvoidingView style={styles.body} behavior="position">
          <SafeAreaView style={{ flex: 1, ...styles.body}}>
            {remoteStream && (
              <RTCView
                //@ts-ignore
                streamURL={remoteStream?.toURL()}
                style={styles.stream}
                objectFit="cover"
                mirror
              />
            )}
            <View style={{flexDirection: 'column', flex: 1}}>
              <TextInput
                value={channelId}
                placeholder="callId"
                style={{borderWidth: 1, paddingHorizontal: 60, paddingVertical: 10,textAlign: 'center', marginTop: 10}}
                onChangeText={newText => setChannelId(newText)}
              />
              <Button title="Join call" onPress={joinCall}/>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    body: {
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
    },
    stream: {
      width: 300,
      height: 300
    },
    buttons: {
      alignItems: 'flex-start',
      flexDirection: 'column',
    },
  });
