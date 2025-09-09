```bash

\# Install Chrome dependencies

sudo apt-get update

sudo apt-get install -y \\

&nbsp;   libnss3 \\

&nbsp;   libnspr4 \\

&nbsp;   libatk-bridge2.0-0 \\

&nbsp;   libdrm2 \\

&nbsp;   libxcomposite1 \\

&nbsp;   libxdamage1 \\

&nbsp;   libxrandr2 \\

&nbsp;   libgbm1 \\

&nbsp;   libxss1 \\

&nbsp;   libasound2 \\

&nbsp;   libatspi2.0-0 \\

&nbsp;   libgtk-3-0

```



```bash

\# Install Google Chrome on Ubuntu/Debian

wget -q -O - https://dl.google.com/linux/linux\_signing\_key.pub | sudo apt-key add -

echo "deb \[arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list

sudo apt-get update

sudo apt-get install -y google-chrome-stable



\# Or install Chromium (lighter alternative)

sudo apt-get install -y chromium-browser

```

