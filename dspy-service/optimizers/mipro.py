"""
DSPy MIPRO optimizer wrapper.

Provides multi-stage instruction proposal optimization.
"""

import dspy
from typing import List, Callable, Optional, Any


class MIPROOptimizer:
    """
    Wraps DSPy MIPRO for multi-stage instruction proposal optimization.

    MIPRO generates multiple instruction candidates and evaluates them
    against training data to find the most effective prompt instructions.
    """

    def __init__(self, module_class: type, metric_fn: Callable):
        """
        Initialize the MIPRO optimizer.

        Args:
            module_class: The DSPy module class to optimize
            metric_fn: Function that scores predictions (example, pred, trace) -> float
        """
        self.module_class = module_class
        self.metric_fn = metric_fn
        self.optimized_module: Optional[dspy.Module] = None
        self.optimization_history: List[dict] = []

    def optimize(
        self,
        trainset: List[dspy.Example],
        num_candidates: int = 10,
        num_threads: int = 4,
        init_temperature: float = 1.0,
        verbose: bool = True
    ) -> dspy.Module:
        """
        Optimize module with MIPRO.

        Note: MIPRO may not be available in all DSPy versions.
        Falls back to BootstrapFewShot if unavailable.

        Args:
            trainset: List of dspy.Example objects
            num_candidates: Number of instruction candidates to generate
            num_threads: Parallel evaluation threads
            init_temperature: Initial sampling temperature
            verbose: Whether to print progress

        Returns:
            Optimized DSPy module
        """
        try:
            # Try to use MIPRO if available
            from dspy.teleprompt import MIPRO

            teleprompter = MIPRO(
                metric=self.metric_fn,
                num_candidates=num_candidates,
                init_temperature=init_temperature,
                verbose=verbose
            )

            self.optimized_module = teleprompter.compile(
                self.module_class(),
                trainset=trainset,
                num_threads=num_threads
            )

            self.optimization_history.append({
                'optimizer': 'MIPRO',
                'trainset_size': len(trainset),
                'num_candidates': num_candidates,
                'success': True
            })

        except ImportError:
            # Fall back to BootstrapFewShot
            print("[MIPRO] Not available, falling back to BootstrapFewShot")
            from dspy.teleprompt import BootstrapFewShot

            teleprompter = BootstrapFewShot(
                metric=self.metric_fn,
                max_bootstrapped_demos=4
            )

            self.optimized_module = teleprompter.compile(
                self.module_class(),
                trainset=trainset
            )

            self.optimization_history.append({
                'optimizer': 'BootstrapFewShot (fallback)',
                'trainset_size': len(trainset),
                'success': True
            })

        except Exception as e:
            self.optimization_history.append({
                'optimizer': 'MIPRO',
                'error': str(e),
                'success': False
            })
            raise

        return self.optimized_module

    def get_optimized_instructions(self) -> Optional[str]:
        """
        Extract optimized instructions from the module.

        Returns:
            The optimized instruction string, or None if not available
        """
        if not self.optimized_module:
            return None

        # Try to access the extended signature's instructions
        if hasattr(self.optimized_module, 'generate'):
            predictor = self.optimized_module.generate
            if hasattr(predictor, 'extended_signature'):
                sig = predictor.extended_signature
                if hasattr(sig, 'instructions'):
                    return sig.instructions

        return None

    def save(self, path: str) -> None:
        """Save optimized module to JSON file."""
        if self.optimized_module:
            self.optimized_module.save(path)

    def load(self, path: str) -> dspy.Module:
        """Load optimized module from JSON file."""
        module = self.module_class()
        module.load(path)
        self.optimized_module = module
        return module

    def get_optimization_stats(self) -> dict:
        """Get statistics about the optimization process."""
        return {
            'is_optimized': self.optimized_module is not None,
            'optimized_instructions': self.get_optimized_instructions(),
            'history': self.optimization_history
        }
