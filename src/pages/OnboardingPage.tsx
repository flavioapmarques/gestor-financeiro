import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { onboardingSlides } from '../lib/mockData'
import { Button } from '../ui/primitives'

export function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const slide = onboardingSlides[step]
  const last = step === onboardingSlides.length - 1

  function finish() {
    localStorage.setItem('gf_onboarding_done', '1')
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] px-6 pt-12 pb-8">
      <button type="button" onClick={finish} className="self-end text-sm text-[var(--text-muted)] font-medium">
        Pular
      </button>

      <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in" key={step}>
        <div className="w-28 h-28 rounded-3xl bg-[var(--primary-soft)] flex items-center justify-center text-5xl mb-8">
          {slide.icon}
        </div>
        <h2 className="text-2xl font-bold text-[var(--text)] mb-3">{slide.titulo}</h2>
        <p className="text-[var(--text-muted)] text-base max-w-[280px] leading-relaxed">{slide.desc}</p>
      </div>

      <div className="flex justify-center gap-2 mb-8">
        {onboardingSlides.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-[var(--primary)]' : 'w-2 bg-[var(--bg-muted)]'}`}
          />
        ))}
      </div>

      <Button
        className="w-full"
        onClick={() => (last ? finish() : setStep(s => s + 1))}
      >
        {last ? 'Começar' : 'Avançar'}
        {!last && <ChevronRight size={18} />}
      </Button>
    </div>
  )
}
