import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { LlmClient } from '../../services/llm-client';
import { BenchmarkConfig, BenchmarkModelOption, TestQuestion } from '../models/benchmark.models';

const MAX_RECOMMENDED_MODELS = 5;
const MAX_RECOMMENDED_QUESTIONS = 20;
const DEFAULT_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

function minArrayLength(min: number): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = control.value;
    return Array.isArray(value) && value.length >= min ? null : { minArrayLength: { min } };
  };
}

@Component({
  selector: 'app-benchmark-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './benchmark-config.component.html',
  styleUrl: './benchmark-config.component.scss',
})
export class BenchmarkConfigComponent {
  @Output() runRequested = new EventEmitter<BenchmarkConfig>();

  readonly availableModels: BenchmarkModelOption[];
  readonly form: FormGroup;

  fileError: string | null = null;

  constructor(private fb: FormBuilder, private llmClient: LlmClient) {
    this.availableModels = this.llmClient.availableModels.map((m) => ({
      id: m.id,
      displayName: m.name,
    }));

    this.form = this.fb.group({
      selectedModelIds: this.fb.control<string[]>([], [Validators.required, minArrayLength(1)]),
      chunkSize: this.fb.control<number>(500, [Validators.required, Validators.min(1)]),
      maxVectorStoreChunks: this.fb.control<number>(500, [Validators.required, Validators.min(1)]),
      inputFile: this.fb.control<File | null>(null, Validators.required),
      embeddingModel: this.fb.control<string>(DEFAULT_EMBEDDING_MODEL),
      similarityThresholdPercent: this.fb.control<number>(70, [
        Validators.required,
        Validators.min(0),
        Validators.max(100),
      ]),
      questions: this.fb.array<FormGroup>([], minArrayLength(1)),
    });

    this.addQuestion();
  }

  get questions(): FormArray<FormGroup> {
    return this.form.get('questions') as FormArray<FormGroup>;
  }

  get selectedModelIdsControl() {
    return this.form.get('selectedModelIds')!;
  }

  addQuestion(): void {
    this.questions.push(
      this.fb.group({
        id: this.fb.control<string>(this.generateId()),
        question: this.fb.control<string>('', [Validators.required, Validators.minLength(1)]),
        expectedAnswer: this.fb.control<string>('', [Validators.required, Validators.minLength(1)]),
      })
    );
  }

  removeQuestion(index: number): void {
    this.questions.removeAt(index);
  }

  onModelToggle(modelId: string, checked: boolean): void {
    const current: string[] = this.selectedModelIdsControl.value ?? [];
    const next = checked ? [...current, modelId] : current.filter((id) => id !== modelId);
    this.selectedModelIdsControl.setValue(next);
    this.selectedModelIdsControl.markAsTouched();
  }

  isModelSelected(modelId: string): boolean {
    const current: string[] = this.selectedModelIdsControl.value ?? [];
    return current.includes(modelId);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (file && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.fileError = 'Selecione um arquivo PDF.';
      this.form.get('inputFile')!.setValue(null);
      return;
    }

    this.fileError = null;
    this.form.get('inputFile')!.setValue(file);
    this.form.get('inputFile')!.markAsTouched();
  }

  get showRunSizeWarning(): boolean {
    const modelCount = (this.selectedModelIdsControl.value ?? []).length;
    const questionCount = this.questions.length;
    return modelCount > MAX_RECOMMENDED_MODELS || questionCount > MAX_RECOMMENDED_QUESTIONS;
  }

  get canRun(): boolean {
    return this.form.valid;
  }

  onRun(): void {
    if (!this.canRun) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const config: BenchmarkConfig = {
      selectedModelIds: value.selectedModelIds,
      chunkSize: value.chunkSize,
      maxVectorStoreChunks: value.maxVectorStoreChunks,
      inputFile: value.inputFile,
      embeddingModel: value.embeddingModel,
      similarityThresholdPercent: value.similarityThresholdPercent,
      questions: value.questions as TestQuestion[],
    };
    this.runRequested.emit(config);
  }

  private generateId(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
