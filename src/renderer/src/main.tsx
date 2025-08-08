import "./css/tailwind.css"
import "./css/spinner.css"
import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import App from "./App"
import { tipcClient } from "./lib/tipc-client"
import { queryClient } from "./lib/query-client"



ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)

document.addEventListener("contextmenu", (e) => {
  e.preventDefault()

  const selectedText = window.getSelection()?.toString()

  tipcClient.showContextMenu({
    x: e.clientX,
    y: e.clientY,
    selectedText,
  })
})
