'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface PromptResponse {
  prompt: string;
  response: string;
  model: string;
  systemPrompt: string;
}

interface EventStatus {
  perplexityStatus: string;
  simplifiedStatus: string;
}

const countries = [
  'France', 'États-Unis', 'Royaume-Uni', 'Allemagne', 'Japon',
  'Canada', 'Australie', 'Italie', 'Espagne', 'Brésil'
]

const audiences = [
  'Primary school children',
  'High school children',
  'Tech Savvy people',
  'Elderly',
  'Young adults eager to learn'
]

interface ImageData {
  prompt: string;
  url: string;
}

export default function Home() {
  const [topic, setTopic] = useState('')
  const [country, setCountry] = useState('France')
  const [audience, setAudience] = useState('')
  const [promptsAndResponses, setPromptsAndResponses] = useState<PromptResponse[]>([])
  const [eventStatus, setEventStatus] = useState<EventStatus | null>(null)
  const [eventStatusInfo, setEventStatusInfo] = useState({ model: '', prompt: '' })
  const [promptsInfo, setPromptsInfo] = useState({ model: '', prompt: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedPrompts, setExpandedPrompts] = useState<number[]>([])
  const [podcastScript, setPodcastScript] = useState('')
  const [imageData, setImageData] = useState<ImageData[]>([])
  const [expandedDetails, setExpandedDetails] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!audience) {
      setError('Please select an audience')
      return
    }
    setLoading(true)
    setPromptsAndResponses([])
    setEventStatus(null)
    setEventStatusInfo({ model: '', prompt: '' })
    setPromptsInfo({ model: '', prompt: '' })
    setError('')
    setExpandedPrompts([])
    setPodcastScript('')
    setImageData([])
    console.log('Submitting topic:', topic, 'Country:', country, 'Audience:', audience)

    try {
      const response = await fetch('/api/getInfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic, country, audience }),
      })

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            handleStreamedData(data)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching information:', error)
      setError('An unexpected error occurred')
    }
    setLoading(false)
  }

  const handleStreamedData = (data: any) => {
    switch (data.type) {
      case 'eventStatus':
        setEventStatus(data.data)
        setEventStatusInfo({ model: data.model, prompt: data.prompt })
        break
      case 'prompts':
        setPromptsAndResponses(data.data.map((prompt: string) => ({ prompt, response: '', model: '', systemPrompt: '' })))
        setPromptsInfo({ model: data.model, prompt: data.prompt })
        break
      case 'response':
        setPromptsAndResponses(prev => prev.map(item => 
          item.prompt === data.data.prompt ? { ...item, ...data.data } : item
        ))
        break
      case 'podcastScript':
        setPodcastScript(data.data)
        break
      case 'imagePrompts':
        setImageData(data.data.map((prompt: string) => ({ prompt, url: '' })))
        break
      case 'images':
        setImageData(prev => prev.map((item, index) => ({
          ...item,
          url: data.data[index] || ''
        })))
        break
      case 'error':
        setError(data.data)
        break
      case 'complete':
        console.log('Request completed')
        break
    }
  }

  const togglePrompt = (index: number) => {
    setExpandedPrompts(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const toggleDetails = (id: string) => {
    setExpandedDetails(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">Albert</h1>
        <form onSubmit={handleSubmit} className="mb-8">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Entrez un sujet"
            className="p-2 border border-gray-300 rounded mr-2"
          />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="p-2 border border-gray-300 rounded mr-2"
          >
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="p-2 border border-gray-300 rounded mr-2"
          >
            <option value="">Select your audience</option>
            {audiences.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-blue-500 text-white p-2 rounded"
            disabled={loading || !audience}
          >
            {loading ? 'Chargement...' : 'Obtenir des infos'}
          </button>
        </form>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {eventStatus && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
            <div>Statut détaillé : {eventStatus.perplexityStatus}</div>
            <div>Statut simplifié : {eventStatus.simplifiedStatus}</div>
            <button 
              onClick={() => toggleDetails('eventStatus')}
              className="text-sm text-blue-600 mt-2 focus:outline-none"
            >
              {expandedDetails.includes('eventStatus') ? 'Masquer les détails' : 'Afficher les détails'}
            </button>
            {expandedDetails.includes('eventStatus') && (
              <div className="text-xs mt-2">
                <div>Model: {eventStatusInfo.model}</div>
                <div>Prompt: {eventStatusInfo.prompt}</div>
              </div>
            )}
          </div>
        )}
        {promptsAndResponses.length > 0 && (
          <div className="bg-gray-100 p-4 rounded mb-4">
            <h2 className="text-xl font-semibold mb-2">Questions et Réponses :</h2>
            <button 
              onClick={() => toggleDetails('promptsInfo')}
              className="text-sm text-blue-600 mb-2 focus:outline-none"
            >
              {expandedDetails.includes('promptsInfo') ? 'Masquer les détails des questions' : 'Afficher les détails des questions'}
            </button>
            {expandedDetails.includes('promptsInfo') && (
              <div className="text-xs mb-4">
                <div>Model pour les questions: {promptsInfo.model}</div>
                <div>Prompt pour les questions: {promptsInfo.prompt}</div>
              </div>
            )}
            {promptsAndResponses.map((item, index) => (
              <div key={index} className="mb-4 border-b pb-2">
                <button 
                  onClick={() => togglePrompt(index)}
                  className="w-full text-left font-semibold bg-gray-200 p-2 rounded"
                >
                  {item.prompt} {expandedPrompts.includes(index) ? '▼' : '▶'}
                </button>
                {expandedPrompts.includes(index) && (
                  <div className="mt-2 p-2 bg-white rounded">
                    <div>{item.response || 'Chargement de la réponse...'}</div>
                    <button 
                      onClick={() => toggleDetails(`response-${index}`)}
                      className="text-sm text-blue-600 mt-2 focus:outline-none"
                    >
                      {expandedDetails.includes(`response-${index}`) ? 'Masquer les détails' : 'Afficher les détails'}
                    </button>
                    {expandedDetails.includes(`response-${index}`) && (
                      <div className="text-xs mt-2">
                        <div>Model: {item.model}</div>
                        <div>System Prompt: {item.systemPrompt}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {podcastScript && (
          <div className="bg-yellow-100 p-4 rounded mb-4">
            <h2 className="text-xl font-semibold mb-2">Script du Podcast :</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{podcastScript}</p>
          </div>
        )}
        {imageData.length > 0 && (
          <div className="bg-purple-100 p-4 rounded mb-4">
            <h2 className="text-xl font-semibold mb-2">Images générées :</h2>
            {imageData.map((image, index) => (
              <div key={index} className="mb-4">
                <button 
                  onClick={() => toggleDetails(`image-${index}`)}
                  className="text-sm text-blue-600 mb-2 focus:outline-none"
                >
                  {expandedDetails.includes(`image-${index}`) ? 'Masquer le prompt' : 'Afficher le prompt'}
                </button>
                {expandedDetails.includes(`image-${index}`) && (
                  <p className="font-semibold mb-2">Prompt : {image.prompt}</p>
                )}
                {image.url ? (
                  <img src={image.url} alt={`Generated image ${index + 1}`} className="mt-2 max-w-full h-auto" />
                ) : (
                  <p>Chargement de l'image...</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}