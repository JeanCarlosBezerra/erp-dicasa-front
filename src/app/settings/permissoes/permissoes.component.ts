// src/app/settings/permissoes/permissoes.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { environment } from '../../../environments/environment';

interface PermissionsConfig {
  roles: Record<string, string[]>;
  groups: Record<string, string[]>;
}

@Component({
  standalone: true,
  selector: 'app-permissoes',
  templateUrl: './permissoes.component.html',
  styleUrls: ['./permissoes.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatSelectModule,
    MatOptionModule,
    MatButtonModule,
    MatSnackBarModule
  ]
})
export class PermissoesComponent implements OnInit {
  config!: PermissionsConfig;
  modules: string[] = [];        // todos os módulos (união de todos os roles)
  roles: string[] = [];          // seus "papéis"
  allGroups: string[] = [];      // seus "grupos"
  form!: FormGroup;
  private api = environment.apiUrl;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private snack: MatSnackBar,
  ) {}
  

  ngOnInit() {
    this.http.get<PermissionsConfig>(`${this.api}/settings/permissions`)
      .subscribe(cfg => {
        this.config    = cfg;
        this.roles     = Object.keys(cfg.roles);
        this.allGroups = Object.keys(cfg.groups);
        // monta array de todos os módulos
        this.modules   = Array.from(new Set(Object.values(cfg.roles).flat()));

        // cria FormGroup de roles e groups
        const rolesFG  = this.fb.group({});
        const groupsFG = this.fb.group({});

        this.roles.forEach(role => {
          rolesFG.addControl(role, new FormControl(cfg.roles[role]));
        });
        this.allGroups.forEach(grp => {
          groupsFG.addControl(grp, new FormControl(cfg.groups[grp]));
        });

        // agrupa ambos
        this.form = this.fb.group({
          roles: rolesFG,
          groups: groupsFG
        });
      });
  }

saveRole(role: string) {
    const modules = this.form.get(['roles', role])!.value as string[];
    this.http
      .put(
        `${this.api}/settings/permissions/roles/${encodeURIComponent(role)}`,
        { modules },
      )
      .subscribe({
        next: () =>
          this.snack.open(`Papéis de ${role} atualizados`, 'OK', { duration: 2000 }),
        error: err =>
          this.snack.open(
            `Erro ao atualizar papéis de ${role}: ${err.message}`,
            'OK',
            { duration: 3000 },
          ),
      });
  }

  saveGroup(grp: string) {
  const roles = this.form.get(['groups', grp])!.value as string[];
  this.http
    .put(
      `${this.api}/settings/permissions/groups/${encodeURIComponent(grp)}`,
      { roles },
    )
    .subscribe({
      next: () =>
        this.snack.open(
          `Grupos de ${this.shortGroup(grp)} atualizados`,
          'OK',
          { duration: 2000 },
        ),
      error: err =>
        this.snack.open(
          `Erro ao atualizar grupos de ${this.shortGroup(grp)}: ${err.message}`,
          'OK',
          { duration: 3000 },
        ),
    });
}

  displayModule(key: string) {
    return key.replace(/\./g, ' → ');
  }

  shortGroup(dn: string) {
    const m = dn.match(/CN=([^,]+)/);
    return m ? m[1] : dn;
  }
}
