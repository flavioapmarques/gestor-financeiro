import { useState, useEffect, useRef, useCallback } from 'react'

// Declaração de tipos para SpeechRecognition da Web API
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: {
    length: number
    item(index: number): {
      isFinal: boolean
      item(index: number): { transcript: string; confidence: number }
      [index: number]: { transcript: string; confidence: number }
    }
    [index: number]: {
      isFinal: boolean
      [index: number]: { transcript: string; confidence: number }
    }
  }
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

export function useReconhecimentoVoz() {
  const [suportado, setSuportado] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const [transcricao, setTranscricao] = useState('')
  const [transcricaoInterim, setTranscricaoInterim] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [volumeAudio, setVolumeAudio] = useState(0) // 0 a 100 para animar a onda sonora

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition
    setSuportado(!!SpeechClass)
  }, [])

  // Inicia captura de áudio com Web Audio API para feedback visual de ondas sonoras
  const iniciarAnaliseAudio = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      audioContextRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const atualizarVolume = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        let soma = 0
        for (let i = 0; i < dataArray.length; i++) {
          soma += dataArray[i]
        }
        const media = soma / dataArray.length
        const normalizado = Math.min(100, Math.round((media / 128) * 100))
        setVolumeAudio(normalizado)
        animFrameRef.current = requestAnimationFrame(atualizarVolume)
      }

      atualizarVolume()
    } catch {
      // Se não conseguir acessar o microfone para o visualizador (ex: sem suporte), segue normalmente
    }
  }, [])

  const pararAnaliseAudio = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    setVolumeAudio(0)
  }, [])

  const pararOuvir = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignora caso já esteja parado
      }
    }
    pararAnaliseAudio()
    setOuvindo(false)
  }, [pararAnaliseAudio])

  const iniciarOuvir = useCallback(() => {
    setErro(null)
    setTranscricao('')
    setTranscricaoInterim('')

    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechClass) {
      setErro('Seu navegador não possui suporte à transcrição nativa de voz. Você pode digitar o comando abaixo.')
      return
    }

    try {
      // Se já houver uma instância ativa, para ela antes
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }

      const recognition = new SpeechClass()
      recognition.lang = 'pt-BR'
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onstart = () => {
        setOuvindo(true)
        setErro(null)
        iniciarAnaliseAudio()
      }

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let textoFinal = ''
        let textoInterim = ''

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i]
          const transcrito = res[0]?.transcript || ''
          if (res.isFinal) {
            textoFinal += transcrito + ' '
          } else {
            textoInterim += transcrito + ' '
          }
        }

        if (textoFinal) {
          setTranscricao(textoFinal.trim())
        }
        setTranscricaoInterim(textoInterim.trim())
      }

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (event.error === 'not-allowed') {
          setErro('Acesso ao microfone negado. Permita o uso do microfone no seu navegador para falar.')
        } else if (event.error === 'no-speech') {
          setErro('Não ouvimos nenhuma fala. Tente falar novamente mais próximo ao microfone.')
        } else if (event.error !== 'aborted') {
          setErro(`Erro no reconhecimento de voz (${event.error}). Você também pode digitar o comando.`)
        }
        pararAnaliseAudio()
        setOuvindo(false)
      }

      recognition.onend = () => {
        setOuvindo(false)
        pararAnaliseAudio()
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não foi possível iniciar o microfone.')
      setOuvindo(false)
      pararAnaliseAudio()
    }
  }, [iniciarAnaliseAudio, pararAnaliseAudio])

  const limparTranscricao = useCallback(() => {
    setTranscricao('')
    setTranscricaoInterim('')
    setErro(null)
  }, [])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {}
      }
      pararAnaliseAudio()
    }
  }, [pararAnaliseAudio])

  return {
    suportado,
    ouvindo,
    transcricao: transcricao || transcricaoInterim,
    transcricaoFinal: transcricao,
    transcricaoInterim,
    volumeAudio,
    erro,
    iniciarOuvir,
    pararOuvir,
    limparTranscricao,
  }
}
