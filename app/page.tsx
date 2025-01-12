"use client"

import Image from 'next/image'

import logo from './assets/logo.png'

import {useChat} from "ai/react"

import{Message} from "ai"

const Home =()=>{
    const {append,isLoading,messages,input, handleInputChange, handleSubmit} = useChat()
    const noMessage = false
    return (
        <main>
            <Image src={logo} alt="logo" width={150} height={50}/>
            <section>
                {noMessage ?(
                    <>
                    <p className='starter-text'>
                        The Ultimate place for 
                    </p>
                    <br/>
                    {/* <PromptSuggestionRow/> */}
                    </>
                ):(
                    <>
                    {/* map message */}
                    {/* <LoadingBubble/> */}
                    </>
                )}
                <form onSubmit={handleSubmit}>
                    <input className='question-box' onChange={handleInputChange} value={input} placeholder='Ask me something...'/>
                    <input type="submit" />
                </form>
            </section>
        </main>
    )
}

export default Home