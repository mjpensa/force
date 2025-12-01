"""
DSPy Signature for Presentation Slides generation.
Single template only: tagline + title (left), body (right).
"""

import dspy
from typing import List


class SlidesSignature(dspy.Signature):
    """Generate presentation slides using a single two-column template.

    Every slide has the exact same layout:
    - Left column: Red uppercase tagline + Large navy title
    - Right column: Body paragraphs
    
    Each slide must have: tagline, title, body (all required).
    
    CRITICAL TITLE TYPOGRAPHY RULES (tight 70% line-height, sentence case):
    
    **AVOID these letters in title words: g, y, p, q, j**
    These descender letters hang below the baseline and overlap with the next line.
    
    Use synonyms instead:
    - "Leading" → "Driving", "Strategy" → "Plan", "Technology" → "Tech"
    - "Growing" → "Expanding", "Building" → "Creating", "Company" → "Firm"
    - "Quality" → "Excellence", "Supply" → "Source", "Delivery" → "Distribution"
    
    EXCEPTION: The LAST LINE of the title may contain g, y, p, q, j (no line below).
    
    Keep titles 3-5 words per line, 2-4 lines total.
    """

    user_prompt: str = dspy.InputField(
        desc="User's presentation request describing the topic and audience"
    )
    research_content: str = dspy.InputField(
        desc="Combined content from research files providing context"
    )

    title: str = dspy.OutputField(
        desc="Presentation title"
    )
    slides: List[dict] = dspy.OutputField(
        desc="Array of slide objects. Each slide must have 'tagline' (uppercase label), 'title' (main headline - AVOID letters g,y,p,q,j except on last line), 'body' (paragraphs)"
    )


class SlidesModule(dspy.Module):
    """DSPy module for slides generation with chain-of-thought reasoning."""

    def __init__(self):
        super().__init__()
        self.generate = dspy.ChainOfThought(SlidesSignature)

    def forward(self, user_prompt: str, research_content: str):
        return self.generate(
            user_prompt=user_prompt,
            research_content=research_content
        )
