import React from 'react';
import icons from '../icons.svg?no-inline';

export default function Icon({ name }) {
  return <svg aria-hidden="true"><use href={`${icons}#${name}`} /></svg>;
}
