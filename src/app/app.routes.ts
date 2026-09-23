import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'benchmark',
    loadComponent: () =>
      import('./benchmark/benchmark-page.component').then((m) => m.BenchmarkPageComponent)
  },
  { path: '**', redirectTo: '' }
];
