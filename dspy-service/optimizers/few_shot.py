"""
DSPy BootstrapFewShot optimizer wrapper.

Provides automatic few-shot example mining from training data.
"""

import dspy
from dspy.teleprompt import BootstrapFewShot
from typing import List, Callable, Optional, Any
import json


class FewShotOptimizer:
    """
    Wraps DSPy BootstrapFewShot for automatic few-shot example mining.

    This optimizer analyzes training examples and selects the most
    effective ones to use as few-shot demonstrations in the prompt.
    """

    def __init__(self, module_class: type, metric_fn: Callable):
        """
        Initialize the few-shot optimizer.

        Args:
            module_class: The DSPy module class to optimize
            metric_fn: Function that scores predictions (example, pred, trace) -> float
        """
        self.module_class = module_class
        self.metric_fn = metric_fn
        self.optimized_module: Optional[dspy.Module] = None
        self.optimization_trace: List[dict] = []

    def optimize(
        self,
        trainset: List[dspy.Example],
        max_bootstrapped_demos: int = 4,
        max_labeled_demos: int = 2,
        max_rounds: int = 1,
        max_errors: int = 5
    ) -> dspy.Module:
        """
        Optimize module with training examples.

        Args:
            trainset: List of dspy.Example objects with inputs and expected outputs
            max_bootstrapped_demos: Maximum number of few-shot examples to mine
            max_labeled_demos: Maximum labeled examples to include
            max_rounds: Number of optimization rounds
            max_errors: Maximum errors before stopping

        Returns:
            Optimized DSPy module with selected few-shot examples
        """
        teleprompter = BootstrapFewShot(
            metric=self.metric_fn,
            max_bootstrapped_demos=max_bootstrapped_demos,
            max_labeled_demos=max_labeled_demos,
            max_rounds=max_rounds,
            max_errors=max_errors
        )

        self.optimized_module = teleprompter.compile(
            self.module_class(),
            trainset=trainset
        )

        # Record optimization trace
        self.optimization_trace.append({
            'trainset_size': len(trainset),
            'max_bootstrapped_demos': max_bootstrapped_demos,
            'max_labeled_demos': max_labeled_demos,
            'demos_selected': len(self.get_demos())
        })

        return self.optimized_module

    def get_demos(self) -> List[dspy.Example]:
        """Get the selected few-shot demonstrations."""
        if not self.optimized_module:
            return []

        # Access demos from the module's predictor
        if hasattr(self.optimized_module, 'generate'):
            predictor = self.optimized_module.generate
            if hasattr(predictor, 'demos'):
                return predictor.demos
        return []

    def save(self, path: str) -> None:
        """
        Save optimized module to JSON file.

        Args:
            path: File path to save the module
        """
        if self.optimized_module:
            self.optimized_module.save(path)

    def load(self, path: str) -> dspy.Module:
        """
        Load optimized module from JSON file.

        Args:
            path: File path to load from

        Returns:
            Loaded and optimized module
        """
        module = self.module_class()
        module.load(path)
        self.optimized_module = module
        return module

    def get_optimization_stats(self) -> dict:
        """Get statistics about the optimization process."""
        demos = self.get_demos()
        return {
            'is_optimized': self.optimized_module is not None,
            'demos_count': len(demos),
            'optimization_rounds': len(self.optimization_trace),
            'trace': self.optimization_trace
        }
