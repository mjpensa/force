"""
DSPy Signature for Research Analysis generation.
"""

import dspy
from typing import List


class ResearchSignature(dspy.Signature):
    """Generate a research analysis report from source documents.

    Analyze the research materials and produce insights, findings,
    and recommendations in a structured format.
    """

    user_prompt: str = dspy.InputField(
        desc="User's analysis request describing what to analyze"
    )
    research_content: str = dspy.InputField(
        desc="Combined content from research files to analyze"
    )

    title: str = dspy.OutputField(
        desc="Analysis report title"
    )
    key_findings: List[str] = dspy.OutputField(
        desc="Array of key findings from the research"
    )
    analysis: List[dict] = dspy.OutputField(
        desc="Array of analysis sections with 'topic' and 'insights'"
    )
    recommendations: List[str] = dspy.OutputField(
        desc="Array of recommendations based on the analysis"
    )


class ResearchModule(dspy.Module):
    """DSPy module for research analysis with chain-of-thought reasoning."""

    def __init__(self):
        super().__init__()
        self.generate = dspy.ChainOfThought(ResearchSignature)

    def forward(self, user_prompt: str, research_content: str):
        return self.generate(
            user_prompt=user_prompt,
            research_content=research_content
        )
