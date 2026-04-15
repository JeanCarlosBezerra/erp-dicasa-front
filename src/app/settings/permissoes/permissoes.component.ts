import { Component, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';  // ← remove HttpHeaders
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import { ChangeDetectorRef } from '@angular/core';

interface Usuario {
  id_usuario: number;
  username: string;
  nome: string;
  id_empresa: number;
  ativo: boolean;
  roles: string;
  criado_em: string;
}

interface CatalogItem {
  key: string;
  label: string;
  description?: string;
  group: string;
}

@Component({
  standalone: true,
  selector: 'app-permissoes',
  templateUrl: './permissoes.component.html',
  styleUrls: ['./permissoes.component.scss'],
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
})
export class PermissoesComponent {  // ← remove OnInit
  usuarios: Usuario[] = [];
  filteredUsuarios: Usuario[] = [];
  catalog: CatalogItem[] = [];
  catalogGroups: { group: string; items: CatalogItem[] }[] = [];
  busca = '';
  private api = environment.apiUrl;
  private cdr = inject(ChangeDetectorRef);

  constructor(private http: HttpClient, private snack: MatSnackBar) {
    afterNextRender(() => {       // ← substitui ngOnInit
      this.loadCatalog();         // só executa no browser
      this.loadUsuarios();        // após hidratação SSR
    });
  }


  loadCatalog() {
    this.http.get<CatalogItem[]>(`${this.api}/permissoes/catalog`)  // ← sem { headers }
      .subscribe({ next: (items) => {
          this.catalog = items;
          const groups = new Map<string, CatalogItem[]>();
          items.forEach(item => {
            if (!groups.has(item.group)) groups.set(item.group, []);
            groups.get(item.group)!.push(item);
          });
          this.catalogGroups = Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
          this.cdr.detectChanges();
        }
      });
  }

  loadUsuarios() {
    this.http.get<Usuario[]>(`${this.api}/permissoes/usuarios`)
      .subscribe({
        next: (users) => {
          this.usuarios = users;
          this.filtrar();
          this.cdr.detectChanges(); // ← dentro do next, após os dados chegarem
        }
      });
  }

  filtrar() {
    const q = this.busca.toLowerCase();
    this.filteredUsuarios = this.usuarios.filter(u =>
      u.username.toLowerCase().includes(q) ||
      (u.nome || '').toLowerCase().includes(q)
    );
  }

  getRoles(user: Usuario): string[] {
    if (!user.roles) return [];
    return user.roles.split(',').map(r => r.trim()).filter(Boolean);
  }

  hasRole(user: Usuario, key: string): boolean {
    return this.getRoles(user).includes(key);
  }

  isAdmin(user: Usuario): boolean {
    return this.getRoles(user).includes('ADMIN');
  }

  toggleRole(user: Usuario, key: string) {
    const roles = this.getRoles(user);
    const idx = roles.indexOf(key);
    if (idx >= 0) {
      roles.splice(idx, 1);
    } else {
      roles.push(key);
    }
    user.roles = roles.join(',');
  }

  removeRole(user: Usuario, key: string) {
    const roles = this.getRoles(user).filter(r => r !== key);
    user.roles = roles.join(',');
  }

  addPermission(user: Usuario, event: Event) {
    const select = event.target as HTMLSelectElement;
    const key = select.value;
    if (!key) return;
    if (!this.hasRole(user, key)) {
      const roles = this.getRoles(user);
      roles.push(key);
      user.roles = roles.join(',');
    }
    select.value = '';
  }

  salvar(user: Usuario) {
    this.http.put(`${this.api}/permissoes/usuarios/${user.id_usuario}/roles`,
      { roles: user.roles || '' }
    ).subscribe({
      next: () => this.snack.open(`Permissões de ${user.username} salvas!`, 'OK', { duration: 2000 }),
      error: () => this.snack.open('Erro ao salvar', 'OK', { duration: 3000 }),
    });
  }

  toggleAtivo(user: Usuario) {
    const novoStatus = !user.ativo;
    this.http.put(`${this.api}/permissoes/usuarios/${user.id_usuario}/toggle`,
      { ativo: novoStatus }
    ).subscribe({
      next: () => {
        user.ativo = novoStatus;
        this.snack.open(`${user.username} ${novoStatus ? 'ativado' : 'desativado'}`, 'OK', { duration: 2000 });
      }
    });
  }

  getLabelForKey(key: string): string {
    const item = this.catalog.find(c => c.key === key);
    return item ? item.label : key;
  }

  availablePermissions(user: Usuario): CatalogItem[] {
    const current = this.getRoles(user);
    return this.catalog.filter(c => !current.includes(c.key));
  }

  copyCSV(user: Usuario) {
    navigator.clipboard.writeText(user.roles || '');
    this.snack.open('Roles copiadas!', 'OK', { duration: 1500 });
  }
}