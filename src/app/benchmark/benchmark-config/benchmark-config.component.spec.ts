import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { BenchmarkConfigComponent } from './benchmark-config.component';

describe('BenchmarkConfigComponent', () => {
  let component: BenchmarkConfigComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BenchmarkConfigComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(BenchmarkConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('is invalid (Run disabled) when required fields are missing', () => {
    expect(component.canRun).toBeFalse();
  });

  it('becomes valid once all required fields are filled', () => {
    component.form.patchValue({
      selectedModelIds: ['some-model'],
      inputFile: new File(['x'], 'doc.pdf', { type: 'application/pdf' }),
    });
    component.questions.at(0).patchValue({ question: 'Q1?', expectedAnswer: 'A1' });

    expect(component.canRun).toBeTrue();
  });

  it('does not show the run-size warning by default', () => {
    expect(component.showRunSizeWarning).toBeFalse();
  });

  it('shows the run-size warning above 5 selected models', () => {
    component.form.get('selectedModelIds')!.setValue(['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);
    expect(component.showRunSizeWarning).toBeTrue();
  });

  it('shows the run-size warning above 20 questions', () => {
    for (let i = 0; i < 21; i++) {
      component.addQuestion();
    }
    expect(component.showRunSizeWarning).toBeTrue();
  });
});
