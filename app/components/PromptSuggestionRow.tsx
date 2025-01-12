import PromptSuggestionsButton from "./PromptSuggestionButton"
const PromptSuggestionRow = ({onPromptClick}) => {
    const prompts = [
        "How do I set up a new source in Segment?",
        "How can I create a user profile in mParticle?",
        "How do I build an audience segment in Lytics?",
        "How can I integrate my data with Zeotap?"
    ]
    return (
        <div className="prompt-suggestion">
            {prompts.map((prompt, index) => (
                <PromptSuggestionsButton key={`prompt-${index}`} text={prompt} onClick={()=>onPromptClick(prompt)} />
            ))}
        </div>
    )
}

export default PromptSuggestionRow