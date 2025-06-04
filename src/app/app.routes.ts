import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./login/login').then(m => m.Login) },
  { path: 'formulario', loadComponent: () => import('./formulario/formulario').then(m => m.Formulario) },
  { path: 'principal', loadComponent: () => import('./principal/principal').then(m => m.Principal) },
  {path: '**',
    redirectTo: 'login'
  }
];
