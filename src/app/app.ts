import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <nav class="app-nav">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Chat</a>
      <a routerLink="/benchmark" routerLinkActive="active">Benchmark</a>
    </nav>
    <router-outlet></router-outlet>
  `,
  styles: [`
    .app-nav {
      display: flex;
      gap: 1.5rem;
      justify-content: center;
      padding: 0.75rem 1rem;
      background: #111111;
      border-bottom: 1px solid #1f1f1f;
    }
    .app-nav a {
      color: #9a9a9a;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
      padding: 0.25rem 0;
      border-bottom: 2px solid transparent;
    }
    .app-nav a.active {
      color: #e6e6e6;
      border-bottom-color: #06d6a0;
    }
  `]
})
export class App {}
