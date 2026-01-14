"use client"

import * as React from "react"

interface AudioOscilloscopeProps {
  stream: MediaStream | null
  /** Wenn false, wird nichts gerendert/kein AudioContext geöffnet */
  isActive: boolean
  className?: string
}

/**
 * Zeigt eine einfache Live-Waveform (Oszilloskop) aus einem MediaStream.
 *
 * Motivation: Nicht-technische Nutzer brauchen visuelles Feedback, dass das Mikrofon
 * wirklich aufnimmt (Signal vorhanden). Das ist bewusst minimal gehalten.
 */
export function AudioOscilloscope({ stream, isActive, className }: AudioOscilloscopeProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null)
  const dataRef = React.useRef<Uint8Array | null>(null)

  React.useEffect(() => {
    if (!isActive || !stream) return

    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return

    const ctx = new AudioContextCtor()
    audioContextRef.current = ctx

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.85
    analyserRef.current = analyser

    const source = ctx.createMediaStreamSource(stream)
    sourceRef.current = source
    source.connect(analyser)

    const bufferLength = analyser.frequencyBinCount
    dataRef.current = new Uint8Array(bufferLength)

    const draw = () => {
      const canvas = canvasRef.current
      const analyserNode = analyserRef.current
      const data = dataRef.current
      if (!canvas || !analyserNode || !data) return

      const ctx2d = canvas.getContext("2d")
      if (!ctx2d) return

      const width = canvas.width
      const height = canvas.height

      analyserNode.getByteTimeDomainData(data)

      // Hintergrund
      ctx2d.clearRect(0, 0, width, height)
      ctx2d.fillStyle = "rgba(0,0,0,0)"
      ctx2d.fillRect(0, 0, width, height)

      // Mittel-Linie (subtiles Grid)
      ctx2d.strokeStyle = "rgba(120,120,120,0.25)"
      ctx2d.lineWidth = 1
      ctx2d.beginPath()
      ctx2d.moveTo(0, height / 2)
      ctx2d.lineTo(width, height / 2)
      ctx2d.stroke()

      // Waveform
      ctx2d.strokeStyle = "rgba(59,130,246,0.95)" // Tailwind blue-500
      ctx2d.lineWidth = 2
      ctx2d.beginPath()

      const sliceWidth = width / data.length
      let x = 0
      for (let i = 0; i < data.length; i++) {
        const v = data[i]! / 128.0 // 0..2
        const y = (v * height) / 2
        if (i === 0) ctx2d.moveTo(x, y)
        else ctx2d.lineTo(x, y)
        x += sliceWidth
      }
      ctx2d.lineTo(width, height / 2)
      ctx2d.stroke()

      rafRef.current = window.requestAnimationFrame(draw)
    }

    rafRef.current = window.requestAnimationFrame(draw)

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null

      try {
        sourceRef.current?.disconnect()
      } catch {
        // ignore
      }

      analyserRef.current = null
      sourceRef.current = null
      dataRef.current = null

      // AudioContext schließen
      const ac = audioContextRef.current
      audioContextRef.current = null
      if (ac && ac.state !== "closed") {
        void ac.close().catch(() => {})
      }
    }
  }, [isActive, stream])

  if (!isActive) return null

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={640}
        height={96}
        className="w-full h-24 rounded-md border bg-background"
      />
    </div>
  )
}
