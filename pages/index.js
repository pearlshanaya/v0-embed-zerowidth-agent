// =============================================================================
// Chat Agent with User & Agent Bubbles (React + Vercel)
//
// This React component renders a chat interface where users can type messages
// and receive responses from an agent via a serverless API endpoint on Vercel.
// Messages are displayed in styled chat bubbles to clearly differentiate between
// user messages (right-aligned) and agent messages (left-aligned).
//
// Key Features:
// - Maintains a conversation history.
// - Displays each message in a styled bubble.
// - Sends user messages to the API and appends the agent's response (rendered as Markdown) to the chat.
// - Automatically scrolls to the latest message in a scrollable parent container.
// - Animates the submit button while the agent is "thinking".
// - Provides detailed comments for ease of understanding.
//
// Author: Thomas J McLeish
// Date: March 2, 2025
// =============================================================================

// Import the chat configuration settings.
// includes the header title, description, and suggested prompts.
import chatConfig from "../config/config";
// Import React hooks for managing state and side effects.
import { useState, useEffect, useRef } from "react";
// Import react-markdown to render markdown content.
import ReactMarkdown from "react-markdown";
// Import UUID to generate session ID
import { v4 as uuidv4 } from "uuid";

/**
 * Retrieves or generates a session ID and stores it in sessionStorage.
 * Ensures it only runs on the client side and limits it to 32 characters.
 * @returns {string} The session ID.
 */
const getSessionId = () => {
  if (typeof window === "undefined") return ""; // Prevent SSR issues

  let sessionId = sessionStorage.getItem("sessionId");
  //if the id is greater than 32 characters, we need to generate a new one.
  sessionId = sessionId && sessionId.length <= 32 ? sessionId : null;

  if (!sessionId) {
    //the generated id is 36 characters long, so we need to remove the dashes and limit it to 32 characters.
    sessionId = uuidv4().replace(/-/g, "").slice(0, 32); // Ensure max 32 chars
    sessionStorage.setItem("sessionId", sessionId);
  }
  return sessionId;
};

/**
 * Retrieves or generates a persistent user ID and stores it in localStorage.
 * Ensures it only runs on the client side and limits it to 32 characters.
 * @returns {string} The user ID.
 */
const getUserId = () => {
  if (typeof window === "undefined") return ""; // Prevent SSR issues

  let userId = localStorage.getItem("userId");
  //if the id is greater than 32 characters, we need to generate a new one.
  userId = userId && userId.length <= 32 ? userId : null;

  if (!userId) {
    //the generated id is 36 characters long, so we need to remove the dashes and limit it to 32 characters.
    userId = uuidv4().replace(/-/g, "").slice(0, 32); // Ensure max 32 chars
    localStorage.setItem("userId", userId);
  }
  return userId;
};

/**
 * AgentComponent renders a chat interface with user and agent bubbles.
 * It manages the conversation state, handles user input and API requests,
 * and renders responses as Markdown.
 *
 * @returns {JSX.Element} The rendered chat interface.
 */
export default function AgentComponent() {
  // State to store the user's current input from the text field.
  const [message, setMessage] = useState("");

  // State to store the conversation as an array of message objects.
  // Each message object has a role ("user" or "agent") and the message content.
  const [conversation, setConversation] = useState([]);

  // State to capture any errors during the API request.
  const [error, setError] = useState(null);

  // State to track if the agent is processing (loading state).
  const [isLoading, setIsLoading] = useState(false);

  // Create a ref to track the end of the messages container.
  const messagesEndRef = useRef(null);

  // Initialize session ID and user ID states.
  const [sessionId, setSessionId] = useState("");
  const [userId, setUserId] = useState("");

  // Initialize the hovered index state for suggested prompts.
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // State to track if the submit button is hovered.
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);

  // Initialize session ID and user ID on the client side
  useEffect(() => {
    setSessionId(getSessionId());
    setUserId(getUserId());
  }, []);

  /**
   * Scrolls the chat container to the bottom to ensure the latest message is visible.
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to the latest message whenever the conversation updates.
  useEffect(() => {
    if (document.querySelector(".chat-container")) {
      scrollToBottom();
    }
  }, [conversation]);

  /**
   * Handles the form submission event.
   * @param {Event} e - The form submission event.
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    submitMessage(message);
  };

  /**
   * Handles the submission of the chat input form.
   *
   * Prevents the default form submission behavior, updates the conversation
   * with the user's message, sends the message to the API, and appends the agent's
   * response to the conversation.
   *
   * @param {Event} e - The form submission event.
   * @returns {Promise<void>} A promise that resolves when the submission is complete.
   */
  const submitMessage = async (userInput) => {
    // If the message is empty, do nothing.
    if (!userInput.trim()) return;

    // Clear the input immediately after user submits
    setMessage("");

    // Clear any previous errors.
    setError(null);

    // Create a new conversation entry for the user's message.
    const userMessage = {
      role: "user",
      content: userInput.trim(),
    };

    // Update the conversation state by adding the user's message.
    setConversation((prev) => [...prev, userMessage]);

    // Prepare the payload for the API call.
    // Note: In production, user_id and session_id should be uniquely generated.
    const payload = {
      data: {
        message: userMessage,
      },
      stateful: true,
      stream: false,
      user_id: userId,
      session_id: sessionId,
      verbose: false,
    };

    try {
      // Set loading state to true to trigger the animation.
      setIsLoading(true);

      // Send a POST request to the serverless API endpoint on Vercel.
      const res = await fetch("/api/proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // If the server response is not OK, throw an error.
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      // Parse the JSON response from the API.
      const data = await res.json();

      // Extract the agent's reply from output_data.content.
      // If output_data or content is missing, fall back to a default message.
      const agentReply =
        data.output_data && data.output_data.content
          ? data.output_data.content
          : "No valid response received from agent.";

      // Create a new conversation entry for the agent's response.
      const agentMessage = {
        role: "agent",
        content: agentReply,
      };

      // Update the conversation state by adding the agent's message.
      setConversation((prev) => [...prev, agentMessage]);

      // Clear the user input field.
      setMessage("");
    } catch (err) {
      // Log the error to the console for debugging.
      console.error("Error fetching agent response:", err);
      // Update the error state so that the user is informed.
      setError(err.message);
    } finally {
      // Reset the loading state regardless of success or error.
      setIsLoading(false);
    }
  };

  /**
   * Inline styles for chat bubbles based on the message role.
   *
   * @type {Object}
   * @property {Object} user - Styles for user messages (right-aligned, light green background).
   * @property {Object} agent - Styles for agent messages (left-aligned, light gray background).
   */
  const bubbleStyles = {
    user: {
      alignSelf: "flex-end",
      backgroundColor: "#DCF8C6",
      color: "#000",
      padding: "10px",
      borderRadius: "10px 0 0 10px",
      borderRight: "5px solid #8EDB5A",
      margin: "0",
      maxWidth: "80%",
      fontSize: "12px",
    },
    agent: {
      alignSelf: "flex-start",
      backgroundColor: "#fff",
      color: "#000",
      padding: "10px",
      borderRadius: "0 10px 10px 0",
      borderLeft: "5px solid #aaf",
      margin: "0",
      maxWidth: "80%",
      fontSize: "12px",
    },
  };

  /**
   * Handles the click event on a suggested prompt.
   *
   * Sets the chat input to the prompt text when clicked.
   * Submit the prompt to the chat
   *
   * @param {Object} prompt - The prompt object containing text and autoSubmit flag.
   */
  const handlePromptClick = async (prompt) => {
    // Set the chat input to the prompt text.
    setMessage(prompt);
    // Submit the prompt to the chat.
    setTimeout(() => {
      submitMessage(prompt);
    }, 0); // Ensures the state has been updated before calling submitMessage
  };

  /**
   * Handles the mouseover event on a suggested prompt.
   * @param {*} index
   */
  const handlePromptMouseOver = (index) => {
    if (!isLoading) {
      setHoveredIndex(index);
    }
  };

  /**
   * Handles the mouseout event on a suggested prompt.
   */
  const handlePromptMouseOut = () => {
    setHoveredIndex(null);
  };

  return (
   <div
      style={{
        padding: "5px",
        width: "100vw",
        maxWidth: "600px",
        margin: "0 auto",
        fontFamily: "'Inter', sans-serif",
        borderRadius: "5px",
        border: "1px solid #8B5E3B",
        backgroundColor: "#FAE3D9",
      }}
    >
      {/* Chat Header */}
      <div
        className="chat-header"
        style={{
          marginBottom: "0px",
          userSelect: "none",
        }}
      >
        <div
          className="chat-title"
          style={{
            backgroundColor: "#8B5E3B",
            color: "#fff",
            padding: "10px",
            borderRadius: "5px",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          {chatConfig.header.title}
        </div>
        <div
          className="chat-description"
          style={{
            padding: "10px",
            borderRadius: "5px",
            fontSize: "12px",
            fontWeight: "normal",
            color: "#4E3D30",
          }}
        >
          {chatConfig.header.description}
        </div>
      </div>

      {/* Chat Messages */}
      <div
        className="chat-container"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          marginBottom: "0px",
          height: chatConfig.maxChatHeight,
          overflowY: "auto",
          border: "2px solid #8B5E3B",
          padding: "10px",
          borderRadius: "5px 5px 0 0",
          backgroundColor: "#FFF5E1",
          width: "100%",
        }}
      >
        {conversation.map((msg, index) => (
          <div
            key={index}
            style={
              msg.role === "user"
                ? { backgroundColor: "#D97B66", color: "#fff", padding: "8px 12px", borderRadius: "10px", alignSelf: "flex-end" }
                : { backgroundColor: "#E4C1B9", color: "#4E3D30", padding: "8px 12px", borderRadius: "10px", alignSelf: "flex-start" }
            }
          >
            {msg.role === "agent" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          border: "1px solid #8B5E3B",
          backgroundColor: "#E4C1B9",
          padding: "5px",
          borderRadius: "5px",
        }}
      >
        <div style={{ margin: "2px", fontSize: "10px", fontStyle: "italic", color: "#4E3D30" }}>
          {chatConfig.suggestedPromptsTitle}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
          {chatConfig.suggestedPrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => handlePromptClick(prompt)}
              onMouseOver={() => handlePromptMouseOver(index)}
              onMouseOut={handlePromptMouseOut}
              disabled={isLoading}
              style={{
                padding: "4px 8px",
                borderRadius: "5px",
                border: "1px solid #8B5E3B",
                margin: "2px",
                backgroundColor: hoveredIndex === index ? "#D97B66" : "#FAE3D9",
                color: hoveredIndex === index ? "#FFF5E1" : "#4E3D30",
                fontSize: "12px",
                cursor: "pointer",
                transition: "background 0.3s ease",
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Field */}
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            width: "100%",
            borderBottom: "1px solid #8B5E3B",
            borderLeft: "1px solid #8B5E3B",
            borderRight: "1px solid #8B5E3B",
            borderRadius: "0 0 5px 5px",
            overflow: "hidden",
            backgroundColor: "#E4C1B9",
          }}
        >
          <input
            type="text"
            id="message"
            placeholder={chatConfig.chatInputPlaceholder}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{
              flexGrow: 1,
              padding: "10px",
              border: "none",
              outline: "none",
              backgroundColor: "#E4C1B9",
              color: "#4E3D30",
              fontSize: "14px",
            }}
          />
          <button
            type="submit"
            aria-label="Send prompt"
            data-testid="send-button"
            disabled={isLoading}
            onMouseOver={() => setIsSubmitHovered(true)}
            onMouseOut={() => setIsSubmitHovered(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "9999px",
              transition: "opacity 0.2s ease",
              backgroundColor: isSubmitHovered ? "#D97B66" : "#8B5E3B",
              color: "#FFF5E1",
              height: "36px",
              width: "36px",
              border: "5px solid #E4C1B9",
              cursor: isLoading ? "default" : "pointer",
            }}
          >
            {!isLoading ? "➤" : "⏳"}
          </button>
        </div>
      </form>

      {/* User & Session Info */}
      <div
        style={{
          marginTop: "2px",
          fontSize: "9px",
          color: "#4E3D30",
          textAlign: "center",
        }}
      >
        User ID: {userId} | Session ID: {sessionId}
      </div>

      {/* Error Handling */}
      {error && (
        <div style={{ color: "red", marginTop: "20px" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Custom Scrollbar & Animations */}
      <style jsx>{`
        .chat-container::-webkit-scrollbar {
          width: 8px;
        }
        .chat-container::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 5px;
        }
        .chat-container::-webkit-scrollbar-thumb {
          background-color: #8B5E3B;
          border-radius: 5px;
        }
        .chat-container {
          scrollbar-width: thin;
          scrollbar-color: #8B5E3B transparent;
        }
      `}</style>
    </div>
  );
}
