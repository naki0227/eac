export type Condition = "A" | "B" | "C";

export type BenchmarkTask = Readonly<{
  id: string;
  prompt: string;
}>;

export type RunStatus =
  "completed" | "agent-timeout" | "agent-crash" | "infrastructure-failure" | "protocol-violation";

export type CliEvent = Readonly<{
  timestamp: string;
  command: string;
  argsCategory: string;
  exitCode: number;
}>;

export type Evaluation = Readonly<{
  exitCode: number;
  errors: number | null;
  warnings: number | null;
  stdout: string;
  stderr: string;
}>;

export type BenchmarkResult = Readonly<{
  run_id: string;
  condition: Condition;
  task_id: string;
  task_prompt: string;
  agent: string;
  model: string | null;
  reasoning_config: string | null;
  cli_version: string;
  implementation_commit: string;
  started_at: string;
  first_valid_at: string | null;
  ended_at: string;
  status: RunStatus;
  task_completion: boolean | null;
  first_check_pass: boolean | null;
  repair_iterations: number | null;
  hallucinated_api_calls: number | null;
  invalid_api_values: number | null;
  docs_search_count: number;
  direct_docs_calls: number;
  check_driven_repair_success: boolean | null;
  final_errors: number | null;
  final_warnings: number | null;
  time_to_valid_project_seconds: number | null;
  generated_loc: number | null;
  cli_calls: number;
  check_calls: number;
  final_source_sha256: string | null;
  protocol_deviations: readonly string[];
  notes: readonly string[];
}>;

export type AgentRunInput = Readonly<{
  runId: string;
  condition: Condition;
  task: BenchmarkTask;
  workspace: string;
  materials: string;
  model: string | null;
  reasoningConfig: string | null;
  timeoutMs: number;
}>;

export type AgentRunOutput = Readonly<{
  exitCode: number | null;
  timedOut: boolean;
  startedAt: string;
  endedAt: string;
  stdout: string;
  stderr: string;
  cliEvents: readonly CliEvent[];
}>;

export type AgentRunner = {
  run(input: AgentRunInput): Promise<AgentRunOutput>;
};
