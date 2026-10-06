import { useState } from 'react';
import { Button } from '../../../components/Button';
import { useSession } from '../../../providers';

export function SignOutButton() {
  const { logout } = useSession();
  const [pending, setPending] = useState(false);

  const handlePress = () => {
    setPending(true);
    // `logout` nunca rechaza y, al terminar, la navegación protegida desmonta esta pantalla.
    void logout().finally(() => setPending(false));
  };

  return <Button label="Cerrar sesión" variant="secondary" onPress={handlePress} loading={pending} />;
}
