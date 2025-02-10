import { useState, useRef, useEffect } from "react";

const MediaStreamer = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [finalDuration, setFinalDuration] = useState(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);

          console.log("New chunk received:", {
            size: event.data.size + " bytes",
            type: event.data.type,
            timestamp: new Date().toISOString(),
            chunkNumber: chunksRef.current.length,
          });

          const totalSize = chunksRef.current.reduce(
            (acc, chunk) => acc + chunk.size,
            0
          );
          console.log("Total data collected:", {
            chunks: chunksRef.current.length,
            totalSize: totalSize + " bytes",
            averageChunkSize:
              Math.round(totalSize / chunksRef.current.length) + " bytes",
          });

          const blobUrl = URL.createObjectURL(event.data);
          console.log("Chunk blob URL (for debugging):", blobUrl);

          sendChunkToBackend(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        console.log("Recording started:", {
          timestamp: new Date().toISOString(),
          mimeType: mediaRecorder.mimeType,
          state: mediaRecorder.state,
        });

        // Start duration timer
        setDuration(0);
        setFinalDuration(null);
        timerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
      };

      mediaRecorder.onstop = () => {
        console.log("Recording stopped:", {
          timestamp: new Date().toISOString(),
          totalChunks: chunksRef.current.length,
          finalState: mediaRecorder.state,
        });
      };

      mediaRecorder.start(1000);
      setIsStreaming(true);
      setError("");
    } catch (err) {
      console.error("Stream start error:", err);
      setError("Failed to access camera/microphone: " + err.message);
    }
  };

  const stopStream = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log("Track stopped:", {
          kind: track.kind,
          label: track.label,
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Stop and clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setFinalDuration(duration);
    }

    videoRef.current.srcObject = null;
    setIsStreaming(false);

    console.log("Stream ended - Final summary:", {
      totalChunks: chunksRef.current.length,
      totalSize:
        chunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0) +
        " bytes",
      duration: duration + " seconds",
    });

    chunksRef.current = [];
  };

  const sendChunkToBackend = async (chunk) => {
    try {
      const formData = new FormData();
      formData.append("chunk", chunk);

      const startTime = performance.now();

      //   await fetch("/api/stream", {
      //     method: "POST",
      //     body: formData,
      //   });

      const endTime = performance.now();

      console.log("Chunk sent to backend:", {
        size: chunk.size + " bytes",
        uploadTime: Math.round(endTime - startTime) + "ms",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to send chunk:", err);
      setError("Failed to send data to server: " + err.message);
    }
  };

  useEffect(() => {
    return () => {
      if (isStreaming) {
        stopStream();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "1rem" }}>
      <div
        style={{
          position: "relative",
          aspectRatio: "16/9",
          backgroundColor: "#111",
          borderRadius: "0.5rem",
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {isStreaming && (
          <div
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              color: "white",
              padding: "0.5rem",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
            }}
          >
            {formatTime(duration)}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "1rem",
          marginTop: "1rem",
          alignItems: "center",
        }}
      >
        {!isStreaming ? (
          <>
            <button
              onClick={startStream}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#2563eb",
                color: "white",
                borderRadius: "0.375rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              Start Streaming
            </button>
            {finalDuration !== null && (
              <div
                style={{
                  color: "#4b5563",
                  fontSize: "0.875rem",
                }}
              >
                Last stream duration: {formatTime(finalDuration)}
              </div>
            )}
          </>
        ) : (
          <button
            onClick={stopStream}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#dc2626",
              color: "white",
              borderRadius: "0.375rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Stop Streaming
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            backgroundColor: "#fee2e2",
            color: "#dc2626",
            padding: "1rem",
            borderRadius: "0.375rem",
            marginTop: "1rem",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default MediaStreamer;
