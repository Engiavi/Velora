"use client"
import "./global.css"
import Image from 'next/image'

import logo from './assets/logo.png'

import { useChat } from "ai/react"

import { Message } from "ai"

import LoadingBubble  from "./components/LoadingBubble"
import PromptSuggestionRow  from "./components/PromptSuggestionRow"
import Bubble from "./components/Bubble"
const Home = () => {
    const { append, isLoading, messages, input, handleInputChange, handleSubmit } = useChat()
    const noMessage = false
    const handlePrompt =(promptText)=>{
        const msg :Message= {
            id:crypto.randomUUID(),
            content:promptText,
            role: "user"
        }
        append(msg)
    }
    return (
        <main>
            <Image src={logo} alt="logo" width={150} height={50} />
            <section className={noMessage ? "" : "populated"}>
                {noMessage ? (
                    <>
                        <p className='starter-text'>
                            The Ultimate place for
                        </p>
                        <br />
                        <PromptSuggestionRow onPromptClick={handlePrompt}/>
                    </>
                ) : (
                    <>
                      {messages.map((msg,index)=>{
                        <Bubble key={`message-${index}`} message={msg} />
                      })}
                        {isLoading && <LoadingBubble/>}
                    </>
                )}

            </section>
            <form onSubmit={handleSubmit}>
                <input className='question-box' onChange={handleInputChange} value={input} placeholder='Ask me something...' />
                <input type="submit" />
            </form>
        </main>
    )
}

export default Home