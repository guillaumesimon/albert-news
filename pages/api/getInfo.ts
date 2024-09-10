import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { Groq } from 'groq-sdk'
import Replicate from "replicate"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

async function checkEventStatus(topic: string): Promise<{ perplexityStatus: string, simplifiedStatus: string }> {
  console.log('Checking event status with Perplexity...')
  const perplexityResponse = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      model: 'llama-3.1-sonar-huge-128k-online',
      messages: [
        { role: 'system', content: 'You are an assistant that analyzes if a topic is related to an event and determines if it\'s past or upcoming.' },
        { role: 'user', content: `Is the topic "${topic}" related to an event? If so, is it past or upcoming compared to today (${new Date().toISOString().split('T')[0]})? Provide a brief explanation.` }
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  )
  const perplexityStatus = perplexityResponse.data.choices[0].message.content.trim()
  console.log('Perplexity event status:', perplexityStatus)

  // Use Groq to process the Perplexity response
  console.log('Processing Perplexity response with Groq...')
  const groqResponse = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are an assistant that categorizes event statuses into simple, single-word responses.' },
      { role: 'user', content: `Based on the following event status description, categorize it as either "past", "future", or "none". Respond with only one of these three words.\n\nDescription: ${perplexityStatus}` }
    ],
    model: 'llama-3.1-70b-versatile',
    temperature: 0,
    max_tokens: 1,
  })

  const simplifiedStatus = groqResponse.choices[0]?.message?.content?.trim().toLowerCase() || 'none'
  console.log('Simplified event status:', simplifiedStatus)
  return { perplexityStatus, simplifiedStatus };
}

async function generatePodcastScript(answers: string[], audience: string, country: string): Promise<string> {
  const audienceDescriptions = {
    'Primary school children': 'âgés de 6 à 11 ans',
    'High school children': 'âgés de 12 à 18 ans',
    'Tech Savvy people': 'passionnés de technologie',
    'Elderly': 'seniors de plus de 65 ans',
    'Young adults eager to learn': 'jeunes adultes curieux entre 18 et 30 ans'
  };

  const audienceDescription = audienceDescriptions[audience as keyof typeof audienceDescriptions] || audience;

  const prompt = `Vous êtes un scénariste de podcast éducatif spécialisé pour un public ${audienceDescription} vivant en ${country}. 
  Utilisez les informations suivantes pour créer un script de podcast éducatif et divertissant en français. 
  Le script doit être engageant et adapté au niveau de compréhension de ce public spécifique. 
  
  Considérations importantes :
  - Pour les enfants du primaire : utilisez un langage simple, des explications courtes et des analogies avec leur vie quotidienne.
  - Pour les lycéens : incluez plus de détails, des faits intéressants et des liens avec leurs études ou l'actualité.
  - Pour les passionnés de technologie : utilisez des termes techniques appropriés et faites des références à l'innovation et aux tendances actuelles.
  - Pour les seniors : utilisez un langage clair, évitez le jargon, et faites des liens avec l'histoire ou leur expérience de vie.
  - Pour les jeunes adultes : adoptez un ton dynamique, incluez des anecdotes intéressantes et des applications pratiques du sujet.

  Incluez des éléments interactifs ou des questions rhétoriques pour garder l'attention de l'auditeur. 
  Le script doit durer environ 5 minutes à la lecture.

  Informations à utiliser : ${answers.join(' ')}

  Format suggéré :
  1. Introduction accrocheuse adaptée au public
  2. Présentation du sujet principal
  3. Développement des points clés de manière adaptée à l'audience
  4. Inclusion d'éléments interactifs ou de questions rhétoriques
  5. Conclusion résumant les points principaux et encourageant la réflexion ou l'action

  Commencez directement avec le script, sans ajouter d'explications supplémentaires.`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.1-70b-versatile',
    temperature: 0.7,
    max_tokens: 1500,
  });

  return response.choices[0]?.message?.content || '';
}

async function generateImagePrompt(summary: string, promptNumber: number): Promise<string> {
  const systemPrompt = `You are an AI assistant specialized in creating prompts for high-quality, realistic image generation. Your task is to create a prompt that will result in a vivid, detailed photograph or illustration suitable for a children's educational podcast. Focus on creating imaginative scenes, rich environments, or intriguing objects that represent the podcast's content. Do not include children or people in the image description. Instead, focus on landscapes, animals, objects, or abstract concepts that children would find fascinating. Use specific details about lighting, perspective, and style to enhance the prompt.`;

  const userPrompt = `Based on the following summary of a French podcast for 9-year-old children, generate a single, detailed prompt in English for an image generation model. The prompt should describe a captivating scene or concept that illustrates the content of the podcast without depicting any people. 

Summary of the podcast: ${summary}

Create a prompt that includes the following elements:
1. A clear subject or focal point related to the podcast topic
2. Vivid details about the environment or setting
3. Specific lighting conditions (e.g., "golden hour sunlight", "soft moonlight", "dramatic studio lighting")
4. Style or medium suggestions (e.g., "photorealistic", "watercolor style", "isometric digital art")
5. Mood or atmosphere descriptors
6. Camera angle or perspective, if relevant
7. Any relevant textures or materials

Format your response as a single paragraph, starting with the main subject and followed by descriptive details. Do not use bullet points or numbered lists in the final prompt. This is prompt number ${promptNumber} of 2.

Remember to respond ONLY with the prompt, without any additional text or explanations.`;

  try {
    console.log(`Sending request to Groq for image prompt ${promptNumber}...`);
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      max_tokens: 300,
    });

    console.log(`Received response from Groq for prompt ${promptNumber}:`, response);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error(`Unexpected empty response from Groq API for prompt ${promptNumber}`);
      return `Error generating image prompt ${promptNumber}`;
    }

    console.log(`Generated image prompt ${promptNumber}:`, content);
    return content.trim();
  } catch (error) {
    console.error(`Error in generateImagePrompt ${promptNumber}:`, error);
    return `Error generating image prompt ${promptNumber}`;
  }
}

async function generateImage(prompt: string): Promise<string> {
  const output = await replicate.run(
    "black-forest-labs/flux-dev",
    {
      input: {
        prompt: prompt,
        num_inference_steps: 50,
        guidance_scale: 7.5,
        negative_prompt: "child, children, person, people, human, blurry, distorted, disfigured, low quality, cartoon, anime, illustration",
        width: 896,
        height: 672,
      }
    }
  );
  
  if (!Array.isArray(output) || output.length === 0) {
    throw new Error('Unexpected output format from Replicate API');
  }
  
  return output[0] as string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { topic, country, audience } = req.body
    console.log('Received request for topic:', topic, 'Country:', country, 'Audience:', audience)

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    })

    try {
      const { perplexityStatus, simplifiedStatus } = await checkEventStatus(topic)
      res.write(`data: ${JSON.stringify({ 
        type: 'eventStatus', 
        data: { perplexityStatus, simplifiedStatus },
        model: 'llama-3.1-70b-versatile',
        prompt: `Based on the following event status description, categorize it as either "past", "future", or "none". Respond with only one of these three words.`
      })}\n\n`)

      console.log('Initializing Groq API call for questions...')
      console.log('Groq API Key present:', !!process.env.GROQ_API_KEY)
      
      let systemPrompt = `Vous êtes un assistant qui génère des questions adaptées pour expliquer un sujet à un public spécifique en français. Générez 5 questions ou prompts pertinents pour obtenir des informations faciles à comprendre sur un sujet donné. Adaptez les questions pour un public ${audience} vivant en ${country}.`
      let userPrompt = `Générez 5 questions ou prompts en français pour expliquer "${topic}" à un public ${audience} vivant en ${country}. `

      switch (simplifiedStatus) {
        case 'past':
          systemPrompt += ' Le sujet est un événement passé. Adaptez les questions en conséquence.'
          userPrompt += 'Comme il s\'agit d\'un événement passé, concentrez-vous uniquement sur ce qui s\'est passé, les résultats et l\'impact. N\'incluez aucune question sur les attentes futures ou sur ce qui va se passer. '
          break;
        case 'future':
          systemPrompt += ' Le sujet est un événement à venir. Adaptez les questions en conséquence.'
          userPrompt += 'Comme il s\'agit d\'un événement à venir, concentrez-vous uniquement sur les attentes, les préparatifs et ce qui pourrait se passer. N\'incluez aucune question sur ce qui s\'est déjà passé. '
          break;
        default:
          systemPrompt += ' Le sujet n\'est pas un événement spécifique ou son statut temporel est incertain. Les questions peuvent être au présent.'
          userPrompt += 'Comme il ne s\'agit pas d\'un événement spécifique ou que son statut temporel est incertain, posez des questions générales sur le sujet. '
      }

      userPrompt += `Les questions doivent être adaptées au niveau de compréhension et aux intérêts d'un public ${audience}. Assurez-vous que chaque question est cohérente avec le statut temporel de l'événement (passé, futur, ou présent) et pertinente pour ce public vivant en ${country}. Répondez uniquement avec la liste numérotée des questions, sans autre texte.`

      const groqCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: 'llama-3.1-70b-versatile',
        temperature: 0.7,
        max_tokens: 500,
      })
      console.log('Groq API call completed successfully')

      const prompts = groqCompletion.choices[0]?.message?.content?.split('\n') || []
      res.write(`data: ${JSON.stringify({ 
        type: 'prompts', 
        data: prompts,
        model: 'llama-3.1-70b-versatile',
        prompt: userPrompt
      })}\n\n`)

      const perplexityResponses = await Promise.all(prompts.map(async (prompt, index) => {
        console.log(`Sending Perplexity request for prompt ${index + 1}:`, prompt)
        const response = await axios.post(
          'https://api.perplexity.ai/chat/completions',
          {
            model: 'llama-3.1-sonar-huge-128k-online',
            messages: [
              { role: 'system', content: 'Vous êtes un assistant utile qui explique des concepts à un enfant de 9 ans en français. Utilisez un langage simple et des exemples concrets.' },
              { role: 'user', content: prompt }
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        )
        console.log(`Received Perplexity response for prompt ${index + 1}`)
        res.write(`data: ${JSON.stringify({ 
          type: 'response', 
          data: { 
            prompt, 
            response: response.data.choices[0].message.content,
            model: 'llama-3.1-sonar-huge-128k-online',
            systemPrompt: 'Vous êtes un assistant utile qui explique des concepts à un enfant de 9 ans en français. Utilisez un langage simple et des exemples concrets.'
          } 
        })}\n\n`)
        return response
      }))

      // Generate podcast script
      console.log('Generating podcast script...')
      const podcastScript = await generatePodcastScript(
        perplexityResponses.map(r => r.data.choices[0].message.content),
        audience,
        country
      );
      res.write(`data: ${JSON.stringify({ type: 'podcastScript', data: podcastScript })}\n\n`);

      // Generate image prompts
      console.log('Generating image prompts...')
      let imagePrompts: string[];
      try {
        const prompt1 = await generateImagePrompt(podcastScript, 1);
        const prompt2 = await generateImagePrompt(podcastScript, 2);
        imagePrompts = [prompt1, prompt2];
        console.log('Generated image prompts:', imagePrompts);
      } catch (error) {
        console.error('Error generating image prompts:', error);
        imagePrompts = ['Error generating image prompt 1', 'Error generating image prompt 2'];
      }
      res.write(`data: ${JSON.stringify({ type: 'imagePrompts', data: imagePrompts })}\n\n`);

      // Generate images
      console.log('Generating images...')
      const images = await Promise.all(imagePrompts.map(generateImage));
      res.write(`data: ${JSON.stringify({ type: 'images', data: images })}\n\n`);

      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`)
    } catch (error) {
      console.error('Error details:', error)
      if (error instanceof Error) {
        res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`)
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', data: 'Une erreur inattendue s\'est produite' })}\n\n`)
      }
    }
    res.end()
  } else {
    console.log(`Received unsupported method: ${req.method}`)
    res.setHeader('Allow', ['POST'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}