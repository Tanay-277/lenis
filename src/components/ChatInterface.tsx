import { useState, useRef, useEffect } from "react";
import {
	FiSend,
	FiUser,
	FiCpu,
	FiCopy,
	FiCheck,
	FiLink,
	FiAlertTriangle,
	FiCode,
	FiClock,
} from "react-icons/fi";
import { HiOutlineChatAlt, HiOutlineLightBulb } from "react-icons/hi";
import { motion } from "framer-motion";
import {
	getStructuredChatResponse,
	StructuredChatResponse,
	ChatResponseItem,
	canMakeRequest,
	getTimeUntilNextRequest,
} from "../utils/gemini";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";
import { Alert, AlertDescription } from "./ui/alert";

interface Message {
	type: "user" | "ai" | "error" | "rate_limit";
	content: string;
	timestamp: Date;
	structuredResponse?: StructuredChatResponse;
}

const messageVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
	exit: { opacity: 0, x: -10, transition: { duration: 0.2 } },
};

const SYSTEM_INSTRUCTION = `
You are a professional legal advisor assistant focused on Indian legal systems.
Provide accurate, well-structured information about legal matters, rights, procedures, and legal guidance.
Always emphasize that this is general legal information and not a substitute for professional legal counsel.
Structure responses in a way that makes complex legal information easy to understand for users.
Focus on being helpful, accurate, and clear while maintaining professional legal standards.
`;

const ChatInterface = () => {
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
	const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
	const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const suggestions = [
		"What are my rights as a tenant in India under the Rent Control Act?",
		"How do I file a consumer complaint under the Consumer Protection Act?",
		"What is the procedure for divorce in India under Hindu Marriage Act?",
		"What legal documents do I need to buy property in India?",
		"How to register an FIR and what are my rights during police investigation?",
	];

	// Check rate limit status periodically
	useEffect(() => {
		const checkRateLimit = () => {
			if (!canMakeRequest()) {
				const timeUntilNext = getTimeUntilNextRequest();
				setRateLimitCountdown(Math.ceil(timeUntilNext / 1000));
			} else {
				setRateLimitCountdown(0);
			}
		};

		checkRateLimit();
		const interval = setInterval(checkRateLimit, 1000);

		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!input.trim()) return;

		// Check rate limit before submitting
		if (!canMakeRequest()) {
			const timeUntilNext = getTimeUntilNextRequest();
			const rateLimitMessage: Message = {
				type: "rate_limit",
				content: `Please wait ${Math.ceil(
					timeUntilNext / 1000
				)} seconds before sending another message. This helps manage API quotas.`,
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, rateLimitMessage]);
			return;
		}

		const userMessage: Message = {
			type: "user",
			content: input.trim(),
			timestamp: new Date(),
		};
		setMessages((prev) => [...prev, userMessage]);

		setInput("");
		setIsLoading(true);

		try {
			const structuredResponse = await getStructuredChatResponse(
				`${SYSTEM_INSTRUCTION}\n\nUser question: ${input.trim()}`
			);

			const aiMessage: Message = {
				type: "ai",
				content: structuredResponse.summary,
				timestamp: new Date(),
				structuredResponse,
			};
			setMessages((prev) => [...prev, aiMessage]);
		} catch (error: any) {
			console.error("Error getting AI response:", error);

			let errorMessage: Message;

			if (
				error.message?.includes("Rate limit") ||
				error.message?.includes("quota")
			) {
				errorMessage = {
					type: "rate_limit",
					content:
						error.message ||
						"Rate limit exceeded. Please wait before making another request.",
					timestamp: new Date(),
				};
			} else {
				errorMessage = {
					type: "error",
					content:
						"Sorry, I encountered an error while processing your request. Please try again.",
					timestamp: new Date(),
				};
			}

			setMessages((prev) => [...prev, errorMessage]);
		} finally {
			setIsLoading(false);
		}
	};

	const copyToClipboard = async (message: Message, index: number) => {
		try {
			let textToCopy = message.content;

			if (message.structuredResponse) {
				const sr = message.structuredResponse;
				textToCopy = `${sr.title}\n\n${sr.summary}\n\n`;

				sr.content.forEach((item) => {
					switch (item.type) {
						case "text":
							textToCopy += `${item.content}\n\n`;
							break;
						case "list":
							if (item.title) textToCopy += `${item.title}:\n`;
							item.items?.forEach((listItem) => {
								textToCopy += `• ${listItem}\n`;
							});
							textToCopy += "\n";
							break;
						case "suggestion":
							textToCopy += `Suggestion: ${item.content}\n\n`;
							break;
						case "warning":
							textToCopy += `Warning: ${item.content}\n\n`;
							break;
						case "resource":
							textToCopy += `Resource: ${item.title}\n${item.content}\n${item.url}\n\n`;
							break;
						case "code":
							textToCopy += `Code (${item.language}):\n${item.content}\n\n`;
							break;
					}
				});
			}

			await navigator.clipboard.writeText(textToCopy);
			setCopiedMessageId(index);

			setTimeout(() => {
				setCopiedMessageId(null);
			}, 2000);
		} catch (err) {
			console.error("Failed to copy text: ", err);
		}
	};

	const formatTimestamp = (timestamp: Date) => {
		return timestamp.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const renderResponseItem = (item: ChatResponseItem, index: number) => {
		switch (item.type) {
			case "text":
				return (
					<p key={index} className="mb-3 text-foreground">
						{item.content}
					</p>
				);

			case "list":
				return (
					<div key={index} className="mb-4">
						{item.title && (
							<h4 className="text-sm font-medium mb-1.5">{item.title}</h4>
						)}
						<ul className="space-y-1 list-disc pl-5">
							{item.items?.map((listItem, i) => (
								<li key={i} className="text-foreground">
									{listItem}
								</li>
							))}
						</ul>
					</div>
				);

			case "suggestion":
				return (
					<div
						key={index}
						className="flex items-start gap-2 mb-3 p-2 bg-primary/5 dark:bg-primary/10 border-l-2 border-primary rounded-sm"
					>
						<HiOutlineLightBulb className="text-primary dark:text-secondary-400 mt-0.5 shrink-0" />
						<p className="text-foreground text-sm">{item.content}</p>
					</div>
				);

			case "warning":
				return (
					<div
						key={index}
						className="flex items-start gap-2 mb-3 p-2 bg-destructive/5 border-l-2 border-destructive rounded-sm"
					>
						<FiAlertTriangle className="text-destructive mt-0.5 shrink-0" />
						<p className="text-destructive dark:text-destructive text-sm">
							{item.content}
						</p>
					</div>
				);

			case "resource":
				return (
					<div
						key={index}
						className="mb-3 p-2 border border-border/60 rounded-md"
					>
						<div className="flex items-center gap-2 mb-1">
							<FiLink className="text-primary dark:text-secondary-400 shrink-0" />
							<h4 className="text-sm font-medium">{item.title}</h4>
						</div>
						<p className="text-sm text-muted-foreground mb-2">{item.content}</p>
						<a
							href={item.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-primary dark:text-secondary-400 hover:underline flex items-center gap-1"
						>
							<span>Visit resource</span>
							<FiLink className="h-3 w-3" />
						</a>
					</div>
				);

			case "code":
				return (
					<div key={index} className="mb-3 relative">
						<div className="bg-muted/80 dark:bg-muted/50 rounded-t-md px-3 py-1.5 text-xs font-mono flex items-center justify-between border border-border/60">
							<div className="flex items-center gap-1.5">
								<FiCode className="h-3.5 w-3.5 text-muted-foreground" />
								<span>{item.language || "code"}</span>
							</div>
						</div>
						<pre className="p-3 bg-muted/30 dark:bg-muted/20 border border-t-0 border-border/60 rounded-b-md overflow-x-auto">
							<code className="text-xs sm:text-sm font-mono text-foreground whitespace-pre">
								{item.content}
							</code>
						</pre>
					</div>
				);

			default:
				return null;
		}
	};

	return (
		<div className="h-full flex flex-col" aria-label="Chat interface">
			{/* Rate limit warning */}
			{/* {rateLimitCountdown > 0 && (
				<Alert className="mx-4 mt-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
					<FiClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
					<AlertDescription className="text-amber-800 dark:text-amber-200">
						Rate limit active. Please wait {rateLimitCountdown} seconds before
						sending another message.
					</AlertDescription>
				</Alert>
			)} */}

			<div
				className="flex-1 overflow-y-auto scroll-style p-4 space-y-4"
				role="log"
				aria-live="polite"
				aria-label="Chat conversation"
			>
				{messages.length === 0 && (
					<div
						className="flex flex-col items-center justify-center h-full text-center space-y-6 text-muted-foreground"
						aria-label="Welcome to chat"
					>
						<motion.div
							initial={{ scale: 0.9, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{ duration: 0.5 }}
						>
							<div className="p-4 rounded-full bg-primary/5 dark:bg-secondary-400/5 mb-4 flex items-center justify-center gap-3">
								<HiOutlineChatAlt
									className="text-primary dark:text-secondary-400"
									size={38}
									aria-hidden="true"
								/>
								<h3 className="text-lg font-medium text-foreground">
									Chat with your Legal Advisor Assistant
								</h3>
							</div>
							<p className="max-w-md mx-auto text-sm mb-8">
								Get legal guidance, understand your rights, and navigate legal
								procedures in India.
								<span className="block text-xs mt-2 text-yellow-600 dark:text-yellow-400">
									Note: This is general legal information, not professional
									legal advice.
								</span>
							</p>
						</motion.div>

						<div className="grid gap-3 w-full max-w-md">
							<p className="text-sm font-medium">Try asking about:</p>
							<div className="grid grid-cols-1 gap-2 w-full place-items-center">
								{suggestions.map((suggestion, i) => (
									<motion.div
										key={i}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.2 + i * 0.1 }}
										className="w-fit"
									>
										<Button
											variant={
												activeSuggestion === suggestion ? "default" : "outline"
											}
											className="w-fit justify-start text-left h-auto py-2.5 px-4 font-normal text-foreground dark:text-foreground "
											size={"default"}
											disabled={rateLimitCountdown > 0}
											onClick={() => {
												setInput(suggestion);
												setActiveSuggestion(suggestion);
												inputRef.current?.focus();
											}}
										>
											{suggestion}
										</Button>
									</motion.div>
								))}
							</div>
						</div>
					</div>
				)}

				{messages.length > 0 && (
					<div className="space-y-6">
						{messages.map((message, index) => (
							<motion.div
								key={index}
								variants={messageVariants}
								initial="hidden"
								animate="visible"
								exit="exit"
								layout
								aria-label={`${message.type === "user" ? "You" : "AI"}: ${
									message.content
								}`}
							>
								<div
									className={`flex ${
										message.type === "user" ? "justify-end" : "justify-start"
									}`}
								>
									<div
										className={`flex ${
											message.type === "user" ? "flex-row-reverse" : "flex-row"
										} items-start gap-3 max-w-[85%]`}
									>
										<Avatar className="h-8 w-8 mt-1 border border-dashed border-border/40">
											<AvatarFallback
												className={`${
													message.type === "user"
														? "bg-primary/10 text-primary"
														: message.type === "error"
														? "bg-destructive/10 text-destructive"
														: message.type === "rate_limit"
														? "bg-amber/10 text-amber-600"
														: "bg-secondary-400/10 dark:bg-secondary-400/20 text-secondary-700 dark:text-secondary-400"
												}`}
												aria-label={
													message.type === "user" ? "Your avatar" : "AI avatar"
												}
											>
												{message.type === "user" ? (
													<FiUser aria-hidden="true" />
												) : message.type === "error" ? (
													"!"
												) : message.type === "rate_limit" ? (
													<FiClock aria-hidden="true" />
												) : (
													<FiCpu aria-hidden="true" />
												)}
											</AvatarFallback>
										</Avatar>

										<Card
											className={`py-0 ${
												message.type === "user"
													? "border-primary/20 dark:border-primary/20 bg-primary/5 dark:bg-primary/10"
													: message.type === "error"
													? "border-destructive/20 bg-destructive/5"
													: message.type === "rate_limit"
													? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
													: "border-border/60 dark:border-border/30 bg-card"
											}`}
										>
											<CardContent className="p-3 sm:p-4">
												{message.type === "ai" && (
													<div className="flex justify-between items-center mb-2">
														<Badge
															variant="outline"
															className="text-xs mb-1 border-secondary-400/30 bg-secondary-400/5 text-secondary-700 dark:text-secondary-300"
														>
															AI Assistant
														</Badge>
														{message.timestamp && (
															<span className="text-xs text-muted-foreground">
																{formatTimestamp(message.timestamp)}
															</span>
														)}
													</div>
												)}

												{message.type === "rate_limit" && (
													<div className="flex justify-between items-center mb-2">
														<Badge
															variant="outline"
															className="text-xs mb-1 border-amber-400/30 bg-amber-400/5 text-amber-700 dark:text-amber-300"
														>
															Rate Limit
														</Badge>
														{message.timestamp && (
															<span className="text-xs text-muted-foreground">
																{formatTimestamp(message.timestamp)}
															</span>
														)}
													</div>
												)}

												{message.type === "user" && message.timestamp && (
													<div className="flex justify-end mb-1">
														<span className="text-xs text-muted-foreground">
															{formatTimestamp(message.timestamp)}
														</span>
													</div>
												)}

												<div
													className={`${
														message.type === "user"
															? "text-primary-900 dark:text-primary-50"
															: message.type === "error"
															? "text-destructive dark:text-destructive"
															: message.type === "rate_limit"
															? "text-amber-800 dark:text-amber-200"
															: "text-foreground"
													}`}
												>
													{message.type === "user" ? (
														<p className="text-sm">{message.content}</p>
													) : message.type === "error" ? (
														<div className="flex items-start gap-2">
															<FiAlertTriangle className="text-destructive mt-0.5 shrink-0" />
															<p className="text-sm">{message.content}</p>
														</div>
													) : message.type === "rate_limit" ? (
														<div className="flex items-start gap-2">
															<FiClock className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
															<p className="text-sm">{message.content}</p>
														</div>
													) : message.structuredResponse ? (
														<div>
															{message.structuredResponse.title && (
																<h3 className="text-base font-medium mb-2">
																	{message.structuredResponse.title}
																</h3>
															)}

															{message.structuredResponse.content.map(
																renderResponseItem
															)}
														</div>
													) : (
														<p className="text-sm">{message.content}</p>
													)}
												</div>

												{message.type === "ai" && (
													<div className="flex justify-end mt-2">
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-7 w-7 p-0 rounded-full"
																		onClick={() =>
																			copyToClipboard(message, index)
																		}
																		aria-label="Copy message to clipboard"
																	>
																		{copiedMessageId === index ? (
																			<FiCheck
																				className="h-3.5 w-3.5 text-green-500"
																				aria-hidden="true"
																			/>
																		) : (
																			<FiCopy
																				className="h-3.5 w-3.5 text-muted-foreground"
																				aria-hidden="true"
																			/>
																		)}
																	</Button>
																</TooltipTrigger>
																<TooltipContent side="bottom" align="end">
																	{copiedMessageId === index
																		? "Copied!"
																		: "Copy to clipboard"}
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													</div>
												)}
											</CardContent>
										</Card>
									</div>
								</div>
							</motion.div>
						))}
						<div ref={messagesEndRef} />
					</div>
				)}

				{isLoading && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="flex items-start gap-3 max-w-[85%]"
						aria-live="polite"
						aria-label="AI is thinking"
					>
						<Avatar className="h-8 w-8 mt-1 border border-border/40">
							<AvatarFallback className="bg-secondary-400/10 text-secondary-700 dark:text-secondary-400">
								<FiCpu aria-hidden="true" />
							</AvatarFallback>
						</Avatar>
						<Card className="border-border/60 dark:border-border/30 bg-card">
							<CardContent className="p-3 sm:p-4 flex items-center">
								<div className="flex space-x-1.5" aria-hidden="true">
									<motion.span
										animate={{
											opacity: [0.4, 1, 0.4],
											scale: [0.9, 1, 0.9],
											transition: { duration: 1, repeat: Infinity },
										}}
										className="w-2.5 h-2.5 bg-primary/70 dark:bg-secondary-400 rounded-full"
									/>
									<motion.span
										animate={{
											opacity: [0.4, 1, 0.4],
											scale: [0.9, 1, 0.9],
											transition: {
												duration: 1,
												delay: 0.33,
												repeat: Infinity,
											},
										}}
										className="w-2.5 h-2.5 bg-primary/70 dark:bg-secondary-400 rounded-full"
									/>
									<motion.span
										animate={{
											opacity: [0.4, 1, 0.4],
											scale: [0.9, 1, 0.9],
											transition: {
												duration: 1,
												delay: 0.66,
												repeat: Infinity,
											},
										}}
										className="w-2.5 h-2.5 bg-primary/70 dark:bg-secondary-400 rounded-full"
									/>
								</div>
								<span className="ml-2 text-sm text-muted-foreground">
									AI is thinking...
								</span>
							</CardContent>
						</Card>
					</motion.div>
				)}
			</div>

			<div className="mt-auto">
				<Separator className="mb-4 border-dashed" />
				<div className="px-4 pb-3">
					<form
						onSubmit={handleSubmit}
						className="flex items-center gap-2"
						aria-label="Message input form"
					>
						<div className="relative flex-1">
							<Input
								ref={inputRef}
								type="text"
								placeholder={
									rateLimitCountdown > 0
										? `Please wait ${rateLimitCountdown}s...`
										: "Type your legal question..."
								}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								autoFocus
								disabled={rateLimitCountdown > 0}
								className="pr-12 rounded-full"
								aria-label="Type your legal question"
							/>
							<Button
								type="submit"
								size="icon"
								disabled={!input.trim() || isLoading || rateLimitCountdown > 0}
								className="absolute right-0 top-0 h-full px-3 rounded-l-none"
								aria-label="Send message"
							>
								{rateLimitCountdown > 0 ? (
									<FiClock
										className="h-4 w-4 text-muted-foreground"
										aria-hidden="true"
									/>
								) : (
									<FiSend
										className={`h-4 w-4 ${
											!input.trim() || isLoading ? "text-muted-foreground" : ""
										}`}
										aria-hidden="true"
									/>
								)}
							</Button>
						</div>
					</form>
					<div className="mt-4 text-xs text-center text-muted-foreground">
						<p>
							This provides general legal information only. Consult a qualified
							lawyer for specific legal advice.
						</p>
						{rateLimitCountdown > 0 && (
							<p className="text-amber-600 dark:text-amber-400 mt-1">
								Rate limiting helps manage API quotas. Free tier has limited
								requests per minute.
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default ChatInterface;
