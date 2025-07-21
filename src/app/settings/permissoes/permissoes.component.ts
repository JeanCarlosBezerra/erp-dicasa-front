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
  roles: string[] = [];
  allGroups: string[] = [];
  modules: string[] = [];

  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.http.get<PermissionsConfig>('/settings/permissions')
      .subscribe(cfg => {
        this.config    = cfg;
        this.roles     = Object.keys(cfg.roles);
        this.allGroups = Object.keys(cfg.groups);
        // coletar todos os módulos (união de todos os roles)
        this.modules   = Array.from(new Set(Object.values(cfg.roles).flat()));

        // monta o form
        const rolesFG  = this.fb.group({});
        const groupsFG = this.fb.group({});

        this.roles.forEach(role => {
          rolesFG.addControl(role, new FormControl(this.config.roles[role]));
        });
        this.allGroups.forEach(grp => {
          groupsFG.addControl(grp, new FormControl(this.config.groups[grp]));
        });

        this.form = this.fb.group({
          roles: rolesFG,
          groups: groupsFG
        });
      });
  }

  saveRole(role: string) {
    const modules = this.form.get(['roles', role])!.value as string[];
    // aqui você criaria um PUT /settings/permissions/roles 
    // com body { role, modules } se quisesse persistir roles
    this.snack.open(`Papéis de ${role} atualizados`, 'OK', { duration: 2000 });
  }

  saveGroup(grp: string) {
    const roles = this.form.get(['groups', grp])!.value as string[];
    this.http.put(`/settings/permissions/${encodeURIComponent(grp)}`, { groups: roles })
      .subscribe(() => {
        this.snack.open(`Grupos de ${grp} atualizados`, 'OK', { duration: 2000 });
      });
  }

  displayModule(key: string) {
    return key.replace(/\./g, ' → ');
  }

  shortGroup(dn: string) {
    // ex: de "CN=Grupo-HCAB-CTIC-Suporte,..." extrai só "Grupo-HCAB-CTIC-Suporte"
    const m = dn.match(/CN=([^,]+)/);
    return m ? m[1] : dn;
  }
}
