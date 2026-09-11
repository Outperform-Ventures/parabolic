import {createContext,useContext} from 'react';

/** Custom controls report committed value changes to their enclosing form.
 * Opening a picker or filtering its options is not an unsaved form edit. */
export const FormChangesContext=createContext<(()=>void)|undefined>(undefined);
export const useFormChanged=()=>useContext(FormChangesContext);
