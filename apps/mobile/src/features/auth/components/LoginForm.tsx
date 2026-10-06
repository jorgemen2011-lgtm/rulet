import { Link } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import type { TextInput } from 'react-native';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { colors, fontSizes } from '../../../theme';
import { useLoginForm } from '../hooks/use-login-form';
import { AuthFormLayout, FormError } from './AuthFormLayout';

export function LoginForm() {
  const { values, errors, formError, submitting, setValue, handleSubmit } = useLoginForm();
  const passwordRef = useRef<TextInput>(null);

  return (
    <AuthFormLayout
      title="Iniciar sesión"
      footer={
        <Link href="/register" style={styles.link} accessibilityRole="link">
          ¿No tienes cuenta? Regístrate
        </Link>
      }
    >
      <TextField
        label="Email"
        value={values.email}
        onChangeText={(text) => setValue('email', text)}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="email"
        // `username` permite a iOS asociar este campo con la contraseña guardada en el llavero.
        textContentType="username"
        maxLength={254}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!submitting}
      />
      <TextField
        ref={passwordRef}
        label="Contraseña"
        value={values.password}
        onChangeText={(text) => setValue('password', text)}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="current-password"
        textContentType="password"
        maxLength={128}
        returnKeyType="go"
        onSubmitEditing={() => void handleSubmit()}
        editable={!submitting}
      />
      <FormError message={formError} />
      <Button label="Entrar" onPress={() => void handleSubmit()} loading={submitting} />
    </AuthFormLayout>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: fontSizes.sm, color: colors.primary, textAlign: 'center' },
});
