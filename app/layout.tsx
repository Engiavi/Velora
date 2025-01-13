
import "./global.css"

export const metadata = {
    title: "Velora",
    description: "Velora is a modern chatbot",
}

const RootLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    )
}

export default RootLayout