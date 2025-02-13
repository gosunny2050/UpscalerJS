import React, { useCallback, useState } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import GitHubButton from 'react-github-btn';
import styles from './header.module.scss';
import { VscClippy } from 'react-icons/vsc';
import { DemoVideo } from './demo-video/demo-video';

export function HomepageHeader() {
  const [copied, setCopied] = useState(false);

  const copyInstallationInstructions = useCallback(() => {
    navigator.clipboard.writeText('npm install upscaler');
    setCopied(false);
    setCopied(true);
    const timer = setTimeout(() => {
      setCopied(false);
    }, 1000);

    return () => {
      clearTimeout(timer);
    }
  }, []);

  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className={clsx("row")}>
        <div className={clsx('col col--4')}>
        <h1 className="hero__title">Enhance images with Javascript and AI</h1>
        <p className={clsx("hero__subtitle", styles.subtitle)}>Increase resolution, retouch, denoise, and more. Open source, Browser & Node compatible. MIT license.</p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/documentation/getting-started">
              Get Started
          </Link>
          <GitHubButton 
            href="https://github.com/thekevinscott/upscalerjs" 
            data-size='large' 
            data-show-count="true" 
            aria-label="Star thekevinscott/upscalerjs on GitHub">Star</GitHubButton>
        </div>
        <code className={clsx(copied ? styles.copied : '')}>
          <button onClick={copyInstallationInstructions}>
          npm install upscaler <VscClippy />
          </button>
          </code>
        </div>
        <div className={clsx('col col--8')}>
          <div className={styles.demo}>
            <DemoVideo />
          </div>
        </div>
      </div>
    </header>
  );
}
