import { IsIn } from 'class-validator';

export type AuthPanel = 'clinic' | 'admin';

export class SelectPanelDto {
  @IsIn(['clinic', 'admin'])
  panel!: AuthPanel;
}
