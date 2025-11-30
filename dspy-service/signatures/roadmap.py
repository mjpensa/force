"""
DSPy Signature for Roadmap/Gantt chart generation.
"""

import dspy
from typing import List


class RoadmapSignature(dspy.Signature):
    """Generate a Gantt chart roadmap from research documents.

    The roadmap should include time periods, swimlanes for categories,
    and tasks with proper scheduling across the timeline.
    """

    user_prompt: str = dspy.InputField(
        desc="User's roadmap request describing what they want to plan"
    )
    research_content: str = dspy.InputField(
        desc="Combined content from research files providing context"
    )

    title: str = dspy.OutputField(
        desc="Title for the roadmap"
    )
    time_columns: List[str] = dspy.OutputField(
        desc="Array of time period labels (e.g., ['Q1 2024', 'Q2 2024', 'Q3 2024'])"
    )
    rows: List[dict] = dspy.OutputField(
        desc="Array of swimlane rows, each with 'label' and 'tasks' array"
    )


class RoadmapModule(dspy.Module):
    """DSPy module for roadmap generation with chain-of-thought reasoning."""

    def __init__(self):
        super().__init__()
        self.generate = dspy.ChainOfThought(RoadmapSignature)

    def forward(self, user_prompt: str, research_content: str):
        return self.generate(
            user_prompt=user_prompt,
            research_content=research_content
        )
