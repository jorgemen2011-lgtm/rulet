import { Link } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import type { TextInput } from 'react-native';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { colors, fontSizes } from '../../../theme';
import { useRegisterForm } from '../hooks/use-register-form';
import { AuthFormLayout, FormError } from './AuthFormLayout';

export function RegisterForm() {
  const { values, errors, formError, submitting, setValue, handleSubmit } = useRegisterForm();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  return (
    <AuthFormLayout
      title="Crear cuenta"
      footer={
        // `dismissTo`: vuelve al login que ya está en la pila en vez de apilar otro.
        <Link href="/login" dismissTo style={styles.link} accessibilityRole="link">
          ¿Ya tienes cuenta? Inicia sesión
        </Link>
      }
    >
      <TextField
        label="Nombre (opcional)"
        value={values.name}
        onChangeText={(text) => setValue('name', text)}
        error={errors.name}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={100}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
        editable={!submitting}
      />
      <TextField
        ref={emailRef}
        label="Email"
        value={values.email}
        onChangeText={(text) => setValue('email', text)}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="email"
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
        autoComplete="new-password"
        // `newPassword` hace que iOS proponga una contraseña segura generada.
        textContentType="newPassword"
        passwordRules="minlength: 12; maxlength: 128;"
        maxLength={128}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
        editable={!submitting}
      />
      <TextField
        ref={confirmRef}
        label="Repite la contraseña"
        value={values.confirmPassword}
        onChangeText={(text) => setValue('confirmPassword', text)}
        error={errors.confirmPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={128}
        returnKeyType="go"
        onSubmitEditing={() => void handleSubmit()}
        editable={!submitting}
      />
      <FormError message={formError} />
      <Button label="Crear cuenta" onPress={() => void handleSubmit()} loading={submitting} />
    </AuthFormLayout>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: fontSizes.sm, color: colors.primary, textAlign: 'center' },
});
