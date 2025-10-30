import React, { useState } from "react";
import { HiOutlineScale } from "react-icons/hi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Gavel, AlertTriangle, Clock, Copy, Check } from "lucide-react";
import { analyzeLegalCase } from "../utils/gemini";
import { Card, CardHeader, CardContent, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";

import { canMakeRequest, getTimeUntilNextRequest } from "../utils/gemini";
import AutocompleteInput from "./AutoComplete";

interface CaseAnalysisResult {
	title: string;
	summary: string;
	legalAssessment: string;
	keyIssues: string[];
	recommendedActions: string[];
	potentialRisks: string[];
	estimatedCosts: string;
	timeline: string;
	nextSteps: string[];
}

// Add options for Case Type and Location here
const caseTypeOptions = [
	"Contract Dispute",
	"Property Case",
	"Consumer Complaint",
	"Criminal",
	"Family Law",
	"Labor",
	"Environmental",
];

const locationOptions = [
	"Mumbai",
	"Delhi High Court",
	"Kerala",
	"Karnataka",
	"Supreme Court of India",
	"Chennai",
	"Bengaluru",
];

const CaseAnalysis = () => {
	const [formData, setFormData] = useState({
		caseType: "",
		location: "",
		caseDescription: "",
		specificQuestion: "",
	});

	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [analysisResult, setAnalysisResult] =
		useState<CaseAnalysisResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [copiedSection, setCopiedSection] = useState<string | null>(null);
	const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

	// Check rate limit status
	React.useEffect(() => {
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

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));

		// Clear error when user starts typing
		if (error) setError(null);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Check if all required fields are filled
		if (
			!formData.caseType ||
			!formData.location ||
			!formData.caseDescription ||
			!formData.specificQuestion
		) {
			setError("Please fill in all required fields");
			return;
		}

		// Check rate limits
		if (!canMakeRequest()) {
			setError(
				`Rate limit active. Please wait ${rateLimitCountdown} seconds before submitting.`
			);
			return;
		}

		setIsAnalyzing(true);
		setError(null);
		setAnalysisResult(null);

		try {
			let caseText = formData.caseDescription;
			if (formData.caseType) {
				caseText = `Case Type: ${formData.caseType}\n\n${caseText}`;
			}
			if (formData.location) {
				caseText = `Location: ${formData.location}\n\n${caseText}`;
			}
			if (formData.specificQuestion) {
				caseText += `\n\nSpecific Legal Question: ${formData.specificQuestion}`;
			}

			// Get the detailed legal analysis
			const legalAssessment = await analyzeLegalCase(caseText);

			// Create a result object with the markdown formatted analysis
			const analysisResult: CaseAnalysisResult = {
				title: formData.caseType || "Legal Case Analysis",
				summary: formData.caseDescription.slice(0, 150) + "...",
				legalAssessment,
				keyIssues: [],
				recommendedActions: [],
				potentialRisks: [],
				estimatedCosts: "Consult with a lawyer for detailed cost estimates",
				timeline:
					"Timeline varies based on case complexity and court procedures",
				nextSteps: [],
			};

			setAnalysisResult(analysisResult);
		} catch (error) {
			console.error("Error analyzing case:", error);
			setError(
				error instanceof Error
					? error.message
					: "Failed to analyze case. Please try again."
			);
		} finally {
			setIsAnalyzing(false);
		}
	};

	const copyToClipboard = async (text: string, section: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedSection(section);
			setTimeout(() => setCopiedSection(null), 2000);
		} catch (err) {
			console.error("Failed to copy text:", err);
		}
	};

	const copyFullAnalysis = async () => {
		if (!analysisResult) return;

		const fullText = `
LEGAL CASE ANALYSIS

Case: ${formData.caseType}
Location: ${formData.location}

SUMMARY:
${analysisResult.summary}

LEGAL ASSESSMENT:
${analysisResult.legalAssessment}

KEY LEGAL ISSUES:
${analysisResult.keyIssues.map((issue) => `• ${issue}`).join("\n")}

RECOMMENDED ACTIONS:
${analysisResult.recommendedActions.map((action) => `• ${action}`).join("\n")}

POTENTIAL RISKS:
${analysisResult.potentialRisks.map((risk) => `• ${risk}`).join("\n")}

NEXT STEPS:
${analysisResult.nextSteps.map((step) => `• ${step}`).join("\n")}

DISCLAIMER: This is general legal information only, not specific legal advice. Consult a qualified lawyer for professional guidance.
		`.trim();

		await copyToClipboard(fullText, "full");
	};

	return (
		<div className="h-full overflow-auto">
			{/* Header Section */}
			<div className="mb-6">
				<h1 className="text-2xl font-semibold mb-2">Case Analysis</h1>
				<p className="text-muted-foreground text-sm">
					Get comprehensive legal analysis powered by AI
				</p>
			</div>

			{/* Alerts */}
			{rateLimitCountdown > 0 && (
				<Alert className="mb-6 border-amber-500/20 bg-amber-50 dark:bg-amber-950/20">
					<Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
					<AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
						AI analysis available in {rateLimitCountdown}s due to rate limits.
					</AlertDescription>
				</Alert>
			)}

			{error && (
				<Alert className="mb-6 border-red-500/20 bg-red-50 dark:bg-red-950/20">
					<AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
					<AlertDescription className="text-red-800 dark:text-red-200 text-sm">
						{error}
					</AlertDescription>
				</Alert>
			)}

			{/* Form Section */}
			<form onSubmit={handleSubmit} className="space-y-6">
				<Card className="border-border/50">
					<CardContent className="pt-6 space-y-6">
						{/* Quick Info Row */}
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<AutocompleteInput
									id="caseType"
									name="caseType"
									label="Case Type *"
									value={formData.caseType}
									onChange={handleInputChange}
									options={caseTypeOptions}
									placeholder="Select or type case type"
									disabled={isAnalyzing}
									required
								/>
							</div>
							<div>
								<AutocompleteInput
									id="location"
									name="location"
									label="Jurisdiction *"
									value={formData.location}
									onChange={handleInputChange}
									options={locationOptions}
									placeholder="Select location"
									disabled={isAnalyzing}
									required
								/>
							</div>
						</div>

						{/* Case Description */}
						<div>
							<Label
								htmlFor="caseDescription"
								className="text-base font-medium mb-2 block"
							>
								Case Description *
							</Label>
							<Textarea
								id="caseDescription"
								name="caseDescription"
								value={formData.caseDescription}
								onChange={handleInputChange}
								placeholder="Describe your legal situation in detail. Include timeline, parties involved, key facts, and any relevant documentation..."
								className="min-h-[140px] resize-none"
								required
								disabled={isAnalyzing}
							/>
						</div>

						{/* Specific Question */}
						<div>
							<Label
								htmlFor="specificQuestion"
								className="text-base font-medium mb-2 block"
							>
								What do you need help with? *
							</Label>
							<Textarea
								id="specificQuestion"
								name="specificQuestion"
								value={formData.specificQuestion}
								onChange={handleInputChange}
								placeholder="What specific legal guidance or questions do you have? (e.g., 'What are my legal options?', 'What documents do I need?')"
								className="min-h-[100px] resize-none"
								required
								disabled={isAnalyzing}
							/>
						</div>

						{/* Disclaimer */}
						<div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/30">
							<AlertTriangle className="size-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
							<p className="text-xs text-amber-800 dark:text-amber-200">
								<span>Disclaimer</span> : This AI provides general legal
								information only, not specific legal advice. Always consult a
								qualified lawyer for your situation.
							</p>
						</div>

						{/* Submit Button */}
						<Button
							type="submit"
							size="lg"
							className="w-full sm:w-auto"
							disabled={isAnalyzing || rateLimitCountdown > 0}
						>
							{isAnalyzing ? (
								<>
									<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
									Analyzing...
								</>
							) : (
								<>
									<Gavel className="h-5 w-5 mr-2" />
									Analyze Case
								</>
							)}
						</Button>
					</CardContent>
				</Card>
			</form>

			{/* Analysis Results */}
			{analysisResult && (
				<div className="mt-10 space-y-6">
					{/* Results Header */}
					<div className="flex items-center justify-between pb-4 border-b">
						<div>
							<h2 className="text-xl font-semibold">Analysis Results</h2>
							<p className="text-sm text-muted-foreground mt-1">
								{formData.caseType} • {formData.location}
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={copyFullAnalysis}
							className="gap-2"
						>
							{copiedSection === "full" ? (
								<>
									<Check className="h-4 w-4 text-green-600" />
									Copied
								</>
							) : (
								<>
									<Copy className="h-4 w-4" />
									Copy All
								</>
							)}
						</Button>
					</div>

					<div className="space-y-6">
						{/* Main Legal Assessment - Full Width */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-base">
									<HiOutlineScale className="h-5 w-5 text-primary" />
									Legal Assessment
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="prose prose-sm dark:prose-invert max-w-none">
									<ReactMarkdown
										remarkPlugins={[remarkGfm]}
										components={{
											p: ({ children }) => (
												<p className="text-foreground/90 my-3 leading-relaxed">
													{children}
												</p>
											),
											ul: ({ children }) => (
												<ul className="list-disc pl-5 my-4 space-y-2">
													{children}
												</ul>
											),
											ol: ({ children }) => (
												<ol className="list-decimal pl-5 my-4 space-y-2">
													{children}
												</ol>
											),
											li: ({ children }) => (
												<li className="text-foreground/90">{children}</li>
											),
											h3: ({ children }) => (
												<h3 className="text-foreground font-semibold text-lg mt-6 mb-3">
													{children}
												</h3>
											),
											h4: ({ children }) => (
												<h4 className="text-foreground font-medium mt-4 mb-2">
													{children}
												</h4>
											),
											strong: ({ children }) => (
												<strong className="font-semibold text-foreground">
													{children}
												</strong>
											),
											blockquote: ({ children }) => (
												<blockquote className="border-l-4 border-primary/30 pl-4 my-4 italic text-muted-foreground">
													{children}
												</blockquote>
											),
										}}
									>
										{analysisResult.legalAssessment}
									</ReactMarkdown>
								</div>
							</CardContent>
						</Card>

						{/* Bottom Disclaimer */}
						<div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/30">
							<AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
							<div>
								<h4 className="font-medium text-amber-900 dark:text-amber-200 mb-1 text-sm">
									Legal Disclaimer
								</h4>
								<p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
									This AI-generated analysis provides general legal information
									only and is not a substitute for professional legal advice.
									Laws vary by jurisdiction and individual circumstances. Always
									consult with a qualified lawyer licensed to practice in your
									jurisdiction for specific legal advice regarding your
									situation.
								</p>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Empty state when no results */}
			{!analysisResult && !isAnalyzing && (
				<div className="mt-12 text-center py-12">
					<div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
						<Gavel className="h-8 w-8 text-muted-foreground" />
					</div>
					<h3 className="text-lg font-medium mb-2">Ready to Analyze</h3>
					<p className="text-sm text-muted-foreground max-w-md mx-auto">
						Fill out the form above to get comprehensive AI-powered legal
						analysis for your case.
					</p>
				</div>
			)}
		</div>
	);
};

export default CaseAnalysis;
