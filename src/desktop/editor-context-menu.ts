import type {MenuItemConstructorOptions} from 'electron';

export type EditableContextMenuState={
  isEditable:boolean;
  editFlags:{canCopy:boolean;canDelete:boolean;canSelectAll:boolean};
};

export function editableContextMenu(state:EditableContextMenuState):MenuItemConstructorOptions[]{
  if(!state.isEditable)return [];
  return [
    {label:'Copy',role:'copy',enabled:state.editFlags.canCopy},
    {label:'Select',role:'selectAll',enabled:state.editFlags.canSelectAll},
    {label:'Delete',role:'delete',enabled:state.editFlags.canDelete},
  ];
}
